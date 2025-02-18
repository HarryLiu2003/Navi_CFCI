import os
import json
import requests
import dotenv

dotenv.load_dotenv()


def _load_model_configs(configuration_file):
    """Loads model configurations from a JSON file."""
    with open(configuration_file, "r", encoding="utf-8") as file:
        configs = json.load(file)

    for model, config in configs.items():
        if config["api_key"].startswith("ENV_"):
            env_var = config["api_key"][4:]  # Remove "ENV_" prefix
            configs[model]["api_key"] = os.getenv(env_var, "MISSING_API_KEY")

    return configs


def _get_model_config(model_choice, model_configs):
    """Retrieves configuration for a given model."""
    model_choice = model_choice.lower()

    if model_choice not in model_configs:
        raise ValueError(f"Invalid model choice '{model_choice}'. Available options: {list(model_configs.keys())}")

    config = model_configs[model_choice]

    if config["api_key"] == "MISSING_API_KEY":
        raise ValueError(f"API key for {model_choice} is missing. Set the environment variable and try again.")

    return config


def _read_interview_file(interview_file):
    """Reads the interview transcript from a file."""
    try:
        with open(interview_file, "r", encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError:
        raise FileNotFoundError(f"Interview file '{interview_file}' not found.")


def _call_model_api(config, interview_text):
    """Calls the AI model API and returns the response."""
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json"
    }

    data = {
        "model": config["model_name"],
        "messages": [
            {"role": "system", "content": "You are an AI assistant that summarizes user interviews."},
            {"role": "user", "content": f"Summarize the following interview transcript:\n\n{interview_text}"}
        ]
    }

    response = requests.post(config["api_url"], json=data, headers=headers)
    
    if response.status_code != 200:
        raise RuntimeError(f"API request failed: {response.status_code}, {response.text}")

    return response.json()


def summarize_interview(model_choice, interview_file, configuration_file):
    """
    Summarizes a user interview using a specified AI model.

    Parameters:
        model_choice (str): Name of the model.
        interview_file (str): Path to the interview transcript file.
        configuration_file (str): Path to the model configuration JSON file.

    Returns:
        str: The model's summary response.
    """
    
    model_configs = _load_model_configs(configuration_file)
    config = _get_model_config(model_choice, model_configs)
    interview_text = _read_interview_file(interview_file)
    response_json = _call_model_api(config, interview_text)

    return response_json