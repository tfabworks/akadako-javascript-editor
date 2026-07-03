#!/usr/bin/env python3
"""AkaDako JavaScript Editor 用の簡易サーバー。

WebMIDI はセキュアコンテキストが必要なため、file:// ではなく
http://localhost 経由で開く（localhost はセキュア扱い）。

    python3 serve.py          # http://localhost:8771/
"""
import http.server
import os

PORT = 8771
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # 開発中の編集がすぐ反映されるようキャッシュしない
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"http://localhost:{PORT}/  (Ctrl+C で終了)")
    http.server.ThreadingHTTPServer(("", PORT), Handler).serve_forever()
