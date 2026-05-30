from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
    )

# CORS permission for allowing the requestes from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/hello")
def read_root():
    return {"message": "Backend Connected Success! AI Engine Ready."}

# Individual message structure define chesthunnam
class ChatMessage(BaseModel):
    role: str      # Deenlo 'user' (candidate) leda 'assistant' (AI) untundi
    content: str   # Actual text message

# Kotha Model: Ippudu Job Description kooda theeskuntundi
class InterviewHistory(BaseModel):
    job_description: str
    history: List[ChatMessage]

@app.post("/api/chat")
def chat_with_ai(data: InterviewHistory):
    try:
        # Prompt ni poorthiga real-world recruiter laaga marcham
        system_prompt = f"""You are a professional Tech Recruiter conducting an interview. 
        Context / Role / Job Description provided by the candidate: {data.job_description}. 
        Rules:
        1. If a full Job Description is provided, ask questions based on it. If a specific role (like TCS NQT) or skill set is mentioned, tailor your questions to evaluate their specific skills and core computer science fundamentals.
        2. Ask one focused question at a time. Tailor follow-up questions based on the candidate's previous answers.
        3. If the candidate doesn't know an answer, react naturally and empathetically.
        4. Do NOT stick to a fixed number of questions. Decide dynamically when you have enough signal to evaluate them.
        5. Once you have enough information, conclude the interview politely. 
        6. IMPORTANT: ONLY in your very last concluding message, you MUST append the exact string [END_INTERVIEW] at the end."""
        messages = [{"role": "system", "content": system_prompt}]

        for msg in data.history:
            messages.append({"role": msg.role, "content": msg.content})

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages
        )

        return {"ai_response": response.choices[0].message.content}
    
    except Exception as e:
        return{"error": str(e)}

# Note: /api/evaluate endpoint same paathade unchu, kani daaniki kooda 'data: InterviewHistory' input theeskuntundi kabatti param pass cheyali.

@app.post("/api/evaluate")
def evaluate_interview(data: InterviewHistory):
    try:
        # Evaluate cheyadaniki kotha strict prompt isthunnam
        messages = [
            {
                "role": "system", 
                "content": 'You are an expert technical interviewer. Review the interview history and provide a final evaluation strictly as a valid JSON object. Do not include any markdown, explanation, or extra text. Use exact schema: {"score": 85, "strengths": ["string", "string"], "improvements": ["string", "string"]}'
            }
        ]
        
        # History loop
        for msg in data.history:
            messages.append({"role": msg.role, "content": msg.content})
            
        # AI call (Temperature thakkuva pedithe exact JSON vasthundi)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.2 
        )
        
        # Ochina JSON string ni frontend ki return chesthunnam
        return {"evaluation": response.choices[0].message.content}
        
    except Exception as e:
        return {"error": str(e)}