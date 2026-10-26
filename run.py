"""Khởi động hệ thống: python run.py  (mặc định http://127.0.0.1:8000)"""
import argparse
import sys

import uvicorn

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1", help="dùng 0.0.0.0 để điện thoại cùng mạng LAN truy cập được")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--reload", action="store_true")
    args = ap.parse_args()
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)
