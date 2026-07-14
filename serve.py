# Tiny static server with HTTP Range support (needed for seeking audio).
# Python's plain `http.server` ignores Range headers, which makes the
# podcast player snap back to 0:00 when you drag the slider.
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        if 'Range' not in self.headers:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None

        size = os.fstat(f.fileno()).st_size
        m = re.match(r'bytes=(\d*)-(\d*)$', self.headers['Range'].strip())
        if not m or (not m.group(1) and not m.group(2)):
            f.close()
            self.send_error(400, 'Bad Range')
            return None

        if m.group(1):
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else size - 1
        else:  # suffix range: last N bytes
            start = max(0, size - int(m.group(2)))
            end = size - 1
        end = min(end, size - 1)

        if start > end or start >= size:
            f.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None

        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self._range_remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, '_range_remaining', None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8330
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f'PhDnD serving on http://localhost:{port}')
    ThreadingHTTPServer(('127.0.0.1', port), RangeHandler).serve_forever()
