import socket
import uvicorn

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

if __name__ == "__main__":
    port = 8000
    max_port = 8005
    
    while is_port_in_use(port) and port < max_port:
        print(f"Port {port} is in use, trying next port...")
        port += 1

    if port == max_port:
        print(f"Could not find an open port between 8000 and {max_port}. Starting anyway to show error.")

    print(f"Starting ApexF1 Backend on port {port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
