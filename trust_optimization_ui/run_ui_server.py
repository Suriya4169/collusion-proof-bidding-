import http.server
import socketserver
import webbrowser
import threading
import time
import sys

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching issues while developing/testing
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def open_browser():
    time.sleep(1.5)
    print(f"Opening default browser at http://localhost:{PORT}")
    webbrowser.open(f"http://localhost:{PORT}")

if __name__ == "__main__":
    Handler = MyHTTPRequestHandler
    
    # Allow port reuse to avoid 'Address already in use' errors on quick restarts
    socketserver.TCPServer.allow_reuse_address = True
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"==================================================")
            print(f"Serving Trust Optimization UI at http://localhost:{PORT}")
            print(f"Press Ctrl+C to terminate the server.")
            print(f"==================================================")
            
            # Start browser in a background thread so it doesn't block the serve loop
            threading.Thread(target=open_browser, daemon=True).start()
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped by user. Exiting.")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)
