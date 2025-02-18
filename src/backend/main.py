import os
from apis.summarization import summarize_interview

def main():
    # Example Usage of Summarization API
    model = "mistral"
    user_interview = "./resources/user_interview.txt"
    model_configuration = "./config/model_configs.json"
        
    result = summarize_interview(model, user_interview, model_configuration)
    text = result["choices"][0]["message"]["content"]
    print(text)


if __name__ == "__main__":
    main()