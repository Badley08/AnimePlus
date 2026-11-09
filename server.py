import http.server
import socketserver
import urllib.request
import urllib.parse
import os
import sys

PORT = 5500
DIRECTORY = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/proxy':
            query = urllib.parse.parse_qs(parsed.query)
            target_url = query.get('url', [None])[0]
            if not target_url:
                self.send_error(400, "Missing url parameter")
                return

            req_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
            # Définir automatiquement le bon Referer pour contourner les protections Anime-Sama
            if 'anime-sama.to' in target_url:
                if 'episodes.js' in target_url:
                    req_headers['Referer'] = target_url.split('episodes.js')[0]
                else:
                    req_headers['Referer'] = 'https://anime-sama.to/'
            elif 'voiranime' in target_url:
                req_headers['Referer'] = 'https://voiranime.be/'

            try:
                req = urllib.request.Request(target_url, headers=req_headers)
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = resp.read()
                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    content_type = resp.headers.get('Content-Type', 'text/plain')
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
            except Exception as e:
                self.send_response(502)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/proxy':
            query = urllib.parse.parse_qs(parsed.query)
            target_url = query.get('url', [None])[0]
            if not target_url:
                self.send_error(400, "Missing url parameter")
                return

            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)

            req_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
                'Content-Type': self.headers.get('Content-Type', 'application/x-www-form-urlencoded'),
                'Accept': '*/*'
            }
            if 'voiranime' in target_url:
                req_headers['Referer'] = 'https://voiranime.be/'

            try:
                req = urllib.request.Request(target_url, data=post_body, headers=req_headers, method='POST')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = resp.read()
                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    content_type = resp.headers.get('Content-Type', 'application/json')
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
            except Exception as e:
                self.send_response(502)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
            return

        self.send_error(404, "Not Found")

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    with ReusableTCPServer(("", port), ProxyHandler) as httpd:
        print(f"Serveur AnimePlus avec Proxy actif sur http://127.0.0.1:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
