import requests
import os

BASE_URL = "http://127.0.0.1:8000"
RESOURCES_DIR = "./resources"
FILE_PATH = os.path.join(RESOURCES_DIR, "user_interview.txt")

# Ensure the directory exists
os.makedirs(RESOURCES_DIR, exist_ok=True)

def test_root():
    response = requests.get(BASE_URL + "/")
    assert response.status_code == 200
    print("Root Endpoint:", response.json())

def test_upload():
    # Write file content once
    with open(FILE_PATH, "w") as f:
        f.write("This is a test file.")

    with open(FILE_PATH, "rb") as f:
        response = requests.post(BASE_URL + "/upload/", files={"file": f})
    
    assert response.status_code == 200
    print("Upload Response:", response.json())

def test_summarize():
    # Write sample transcript text for summarization
    with open(FILE_PATH, "w") as f:
        f.write("This is a sample transcript for summarization.")

    response = requests.post(BASE_URL + "/summarize/", files={"file": FILE_PATH})
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Text: {response.text}")

    assert response.status_code == 200
    try:
        # Check if expected content is returned
        response_json = response.json()
        print("Summarization Response:", response_json)
    except ValueError:
        print("Invalid JSON response:", response.text)

def test_extract_pain_points():
    # Write pain point data to file
    with open(FILE_PATH, "w") as f:
        f.write("Users find the app slow and difficult to navigate.")

    with open(FILE_PATH, "rb") as f:
        response = requests.post(BASE_URL + "/extract_pain_points/", files={"file": f})

    assert response.status_code == 200
    try:
        response_json = response.json()
        print("Pain Points Response:", response_json)
    except ValueError:
        print("Invalid JSON response:", response.text)

if __name__ == "__main__":
    test_root()
    test_upload()
    test_summarize()
    test_extract_pain_points()
