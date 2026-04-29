#!/usr/bin/env python3
"""Server manager that keeps Next.js production server alive."""
import subprocess
import time
import os
import signal
import sys

SERVER_CMD = ["node", "server.js"]
SERVER_DIR = "/home/z/my-project/.next/standalone"
LOG_FILE = "/home/z/my-project/dev.log"
MAX_RESTARTS = 100
RESTART_DELAY = 3

restarts = 0

def write_log(msg):
    try:
        with open(LOG_FILE, "a") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except:
        pass

def signal_handler(sig, frame):
    write_log("Received signal, shutting down...")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

write_log("Server manager started")

while restarts < MAX_RESTARTS:
    try:
        write_log(f"Starting production server (attempt {restarts + 1})...")
        proc = subprocess.Popen(
            SERVER_CMD,
            cwd=SERVER_DIR,
            stdout=open(LOG_FILE, "a"),
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid
        )
        write_log(f"Server started with PID {proc.pid}")
        
        # Wait for the process to exit
        retcode = proc.wait()
        write_log(f"Server exited with code {retcode}")
        
    except Exception as e:
        write_log(f"Error starting server: {e}")
    
    restarts += 1
    if restarts < MAX_RESTARTS:
        write_log(f"Restarting in {RESTART_DELAY} seconds...")
        time.sleep(RESTART_DELAY)

write_log("Max restarts reached, exiting")
