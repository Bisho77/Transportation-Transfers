#!/usr/bin/env python3
"""
Transportation & Transfers — web server + tiny JSON API backed by SQLite.

Serves the static website AND provides:
  GET    /api/config      -> owner settings (rates, extras, fixed fares, contact)
  PUT    /api/config      -> save owner settings
  GET    /api/bookings    -> list of all customer bookings (newest first)
  POST   /api/bookings    -> store a new booking
  DELETE /api/bookings?ref=XYZ -> delete a booking
  GET    /api/health      -> {"ok": true, "db": "sqlite"}

The database lives in ./data/transfers.db (SQLite — a real SQL database, zero setup).
The front-end falls back to browser storage automatically if this server is not present
(e.g. when the site is opened as plain static files).
"""
import http.server
import json
import os
import sqlite3
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs

PORT = 8080
BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
DB = os.path.join(DATA, "transfers.db")
os.makedirs(DATA, exist_ok=True)

_lock = threading.Lock()
_conn = sqlite3.connect(DB, check_same_thread=False)
_conn.execute("CREATE TABLE IF NOT EXISTS config ("
              "id INTEGER PRIMARY KEY CHECK (id = 1), "
              "json TEXT NOT NULL, updated TEXT)")
_conn.execute("CREATE TABLE IF NOT EXISTS bookings ("
              "ref TEXT PRIMARY KEY, "
              "ts TEXT NOT NULL, "
              "name TEXT, phone TEXT, vehicle TEXT, total REAL, "
              "json TEXT NOT NULL)")
_conn.commit()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    # ---------- helpers ----------
    def _json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def _body_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw or b"{}")
        except json.JSONDecodeError:
            return {}

    # ---------- routing ----------
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            self._json({"ok": True, "db": "sqlite", "file": os.path.relpath(DB, BASE)})
        elif path == "/api/config":
            with _lock:
                row = _conn.execute("SELECT json FROM config WHERE id=1").fetchone()
            self._json(json.loads(row[0]) if row else {})
        elif path == "/api/bookings":
            with _lock:
                rows = _conn.execute("SELECT json FROM bookings ORDER BY ts DESC").fetchall()
            self._json([json.loads(r[0]) for r in rows])
        else:
            super().do_GET()

    def do_PUT(self):
        path = urlparse(self.path).path
        if path == "/api/config":
            data = self._body_json()
            now = datetime.now(timezone.utc).isoformat()
            with _lock:
                _conn.execute(
                    "INSERT INTO config(id, json, updated) VALUES (1, ?, ?) "
                    "ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated=excluded.updated",
                    (json.dumps(data), now))
                _conn.commit()
            self._json({"ok": True, "updated": now})
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/bookings":
            data = self._body_json()
            ref = str(data.get("ref") or ("BRZ-" + str(int(time.time()))))
            ts = str(data.get("ts") or datetime.now(timezone.utc).isoformat())
            with _lock:
                _conn.execute(
                    "INSERT OR REPLACE INTO bookings(ref, ts, name, phone, vehicle, total, json) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (ref, ts, data.get("name"), data.get("phone"),
                     data.get("vehicleName"), data.get("total"), json.dumps(data)))
                _conn.commit()
            self._json({"ok": True, "ref": ref})
        else:
            self._json({"error": "not found"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path == "/api/bookings":
            ref = (parse_qs(urlparse(self.path).query).get("ref") or [""])[0]
            with _lock:
                _conn.execute("DELETE FROM bookings WHERE ref=?", (ref,))
                _conn.commit()
            self._json({"ok": True})
        else:
            self._json({"error": "not found"}, 404)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    print(f"Transportation & Transfers serving http://0.0.0.0:{PORT}  (SQLite db: {os.path.relpath(DB, BASE)})")
    server.serve_forever()
