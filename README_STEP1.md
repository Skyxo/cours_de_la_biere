# File: README_STEP1.md
"""
How to run Step 1 (backend)

1. Create a virtual env and install dependencies:
   python -m venv venv
   source venv/bin/activate   # (on Windows: venv\Scripts\activate)
   pip install fastapi uvicorn

2. Run the server:
   uvicorn server:app --reload --port 8000

3. Test endpoints:
   GET prices:  curl http://127.0.0.1:8000/prices
   POST buy:   curl -X POST http://127.0.0.1:8000/buy -H 'Content-Type: application/json' -d '{"drink_id":1,"quantity":2}'
   GET history: curl http://127.0.0.1:8000/history

Notes:
- Database file will be created at ./db/data.db with initial sample drinks if not present.
- This step focuses on the API and persistence. Frontend will come in Step 2.
"""
