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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str      
    content: str   

class InterviewHistory(BaseModel):
    resume: str
    job_description: str
    history: List[ChatMessage]

@app.post("/api/chat")
def chat_with_ai(data: InterviewHistory):
    try:
        system_prompt = f"""You are a professional Tech Interviewer. 
        Job Description (JD): {data.job_description}
        Candidate Resume: {data.resume}

        CRITICAL RULES:
        1. Analyze Resume & JD: Ask one focused question at a time. Align your questions with the JD and verify the skills mentioned in the Resume.
        2. Dynamic Difficulty: Start with an 'Easy' conceptual question. If the response is strong, increase difficulty to 'Medium' then 'Hard' (scenario-based). If weak, reduce or stabilize the difficulty.
        3. Time Penalty: If the candidate's answer includes the tag [TIME_OUT], it means they failed to answer within the strict time limit. Penalize their evaluation later.
        4. Early Termination: If the candidate gives 2 completely irrelevant or extremely poor answers, end the interview early immediately and append the exact string [EARLY_TERMINATION] at the end.
        5. Standard Termination: Once you have enough signal to generate a final readiness score, conclude politely and append the exact string [END_INTERVIEW] at the end."""

        messages = [{"role": "system", "content": system_prompt}]

        for msg in data.history:
            messages.append({"role": msg.role, "content": msg.content})

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages
        )

        return {"ai_response": response.choices[0].message.content}
    
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/evaluate")
def evaluate_interview(data: InterviewHistory):
    try:
        eval_prompt = f"""Review the entire interview history for the JD: {data.job_description} and Resume: {data.resume}.
        Provide an objective evaluation strictly as a valid JSON object. No extra text.
        Calculate the score based on Accuracy, Clarity, Depth, Relevance, and Time Efficiency.
        
        Use EXACTLY this JSON schema:
        {{
            "readiness_score": 85,
            "category": "Strong / Average / Needs Improvement",
            "performance_breakdown": {{"Technical": 80, "Communication": 90, "Problem_Solving": 75}},
            "strengths": ["string", "string"],
            "weaknesses": ["string", "string"],
            "actionable_feedback": ["string", "string"]
        }}"""

        messages = [{"role": "system", "content": eval_prompt}]
        for msg in data.history:
            messages.append({"role": msg.role, "content": msg.content})
            
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.1 
        )
        return {"evaluation": response.choices[0].message.content}
        
    except Exception as e:
        return {"error": str(e)}