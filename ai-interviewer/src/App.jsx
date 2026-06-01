import { useState, useEffect, useRef } from 'react';

function App() {
  const [appStage, setAppStage] = useState('SETUP');
  const [jobDescription, setJobDescription] = useState('');
  const [resume, setResume] = useState('');
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [evaluation, setEvaluation] = useState(null);
  
  const [isListening, setIsListening] = useState(false);
  
  // HACKATHON FIX: Kotha state for AI speaking
  const [isAISpeaking, setIsAISpeaking] = useState(false); 
  
  const userInputRef = useRef('');
  useEffect(() => {
    userInputRef.current = userInput;
  }, [userInput]);

  // TIMER LOGIC: AI loading lo unna, User mic on unna, AI matladuthunna... timer aagipothundi!
  useEffect(() => {
    let timer;
    if (appStage === 'CHATTING' && !isLoading && !isListening && !isAISpeaking && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && appStage === 'CHATTING' && !isLoading && !isListening && !isAISpeaking) {
      handleTimeout();
    }
    return () => clearInterval(timer);
  }, [appStage, isLoading, timeLeft, isListening, isAISpeaking]);

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      setIsAISpeaking(true); // AI start chesindi

      const cleanText = text.replace(/\[.*?\]/g, '').replace(/\*/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US'; 
      utterance.rate = 1.0; 
      utterance.pitch = 1.1; 
      
      // AI matladatam poorthi ayyaka timer EXACT 60 seconds ki reset avuthundi
      utterance.onend = () => {
        setIsAISpeaking(false);
        setTimeLeft(60); 
      };

      utterance.onerror = () => {
        setIsAISpeaking(false);
        setTimeLeft(60);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeLeft(60); // Audio support lekapothe direct reset
    }
  };

  // HACKATHON FIX: Added Cooldown Lock to prevent Mic Fluctuation/Flickering
  const toggleListening = () => {
    // 1. Double click/fluctuation aagadaniki 500ms cooldown lock pettam
    if (window.micLock) return;
    window.micLock = true;
    setTimeout(() => { window.micLock = false; }, 500);

    // 2. Already on lo unte off chesthunnam
    if (isListening) {
      if (window.recognitionInstance) {
        window.recognitionInstance.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support Speech Recognition. Please use Google Chrome.");
      return;
    }

    // 3. Paatha ghost instances unte force-abort chesthunnam
    if (window.recognitionInstance) {
      try { window.recognitionInstance.abort(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    window.recognitionInstance = recognition;
    
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.lang = 'en-US';

    const baseText = userInputRef.current.trim() ? userInputRef.current.trim() + " " : "";

    recognition.onstart = () => {
        setIsListening(true);
    };
    
    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setUserInput(baseText + final + interim);
    };

    recognition.onerror = (e) => {
      console.error("Mic error:", e.error);
      if (e.error === 'not-allowed') {
          alert("Microphone permission denied! Please click the lock icon in the URL bar and allow it.");
      }
      // no-speech vasthe silent ga ignore cheyali, lekapothe malli fluctuate avuthundi
      if (e.error !== 'no-speech') {
          setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };
    
    try {
      recognition.start();
    } catch (e) {
      console.error("Mic start error:", e);
      setIsListening(false);
    }
  };

  const startInterview = () => {
    if (!jobDescription.trim() || !resume.trim()) return alert("Please enter both Job Description and Resume.");
    
    const introText = "Hello! I've reviewed your resume against the provided job description. Let's start with a quick introduction.";
    setMessages([
      { role: 'assistant', content: introText }
    ]);
    
    setAppStage('CHATTING');
    setTimeLeft(60); 
    speakText(introText);
  };

  const handleTimeout = async () => {
    const timeoutMessage = { role: 'user', content: "[TIME_OUT] Candidate failed to answer in time." };
    processMessage(timeoutMessage, true);
  };

  const handleSend = () => {
    if (!userInput.trim()) return;
    
    if (window.recognitionInstance) {
      window.recognitionInstance.stop();
      setIsListening(false);
    }
    
    // Nuvvu send kottagane okavela AI inka matladuthunte daanni aapeyi
    window.speechSynthesis.cancel(); 
    setIsAISpeaking(false); 
    
    const userMsg = { role: 'user', content: userInput };
    setUserInput('');
    processMessage(userMsg, false);
  };

  const processMessage = async (newUserMessage, isTimeout) => {
    const updatedHistory = [...messages, newUserMessage];
    setMessages(updatedHistory);
    setIsLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resume: resume,
          job_description: jobDescription, 
          history: updatedHistory 
        }), 
      });

      const data = await response.json();
      
      if (data.ai_response) {
        let aiText = data.ai_response;
        let isInterviewOver = false;

        if (aiText.includes('[EARLY_TERMINATION]')) {
          aiText = aiText.replace('[EARLY_TERMINATION]', '').trim(); 
          isInterviewOver = true;
        }
        if (aiText.includes('[END_INTERVIEW]')) {
          aiText = aiText.replace('[END_INTERVIEW]', '').trim(); 
          isInterviewOver = true;
        }

        const finalHistory = [...updatedHistory, { role: 'assistant', content: aiText }];
        setMessages(finalHistory);
        
        speakText(aiText);

        if (isInterviewOver) {
           setAppStage('ENDED');
           getFeedback(finalHistory);
        }
      }
    } catch (error) {
      console.error("Chat Fetch error:", error);
    }
    setIsLoading(false);
  };

  const getFeedback = async (finalHistory) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resume: resume,
          job_description: jobDescription, 
          history: finalHistory 
        }), 
      });

      const data = await response.json();
      
      let rawOutput = data.evaluation;
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) throw new Error("No JSON object found in AI response");
      
      let cleanJsonString = jsonMatch[0];
      const resultData = JSON.parse(cleanJsonString);
      
      setEvaluation(resultData); 
      setAppStage('EVALUATED');
      
      speakText("Interview complete. Your final evaluation report is ready on the screen.");
      
    } catch (error) {
      console.error("Evaluation error:", error);
      alert("Evaluation failed. Please check the console logs for details.");
    }
    setIsLoading(false);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '800px', margin: 'auto' }}>
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
          }
          @keyframes aiGlow {
            0% { color: #007bff; text-shadow: 0 0 5px rgba(0, 123, 255, 0.2); }
            50% { color: #0056b3; text-shadow: 0 0 15px rgba(0, 123, 255, 0.6); }
            100% { color: #007bff; text-shadow: 0 0 5px rgba(0, 123, 255, 0.2); }
          }
        `}
      </style>

      <h2 style={{ textAlign: 'center', color: '#333' }}>🤖 Hack2Hire Mock Interviewer</h2>

      {appStage === 'SETUP' && (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3>Interview Setup</h3>
          <div>
            <label style={{ fontWeight: 'bold' }}>Job Description (JD):</label>
            <textarea 
              rows="4" 
              style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px' }}
              placeholder="Paste Job Description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>Candidate Resume (Text):</label>
            <textarea 
              rows="6" 
              style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px' }}
              placeholder="Paste Candidate Resume details here..."
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
          </div>
          <button 
            onClick={startInterview}
            style={{ padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            Start Interview Simulation
          </button>
        </div>
      )}

      {appStage === 'CHATTING' && (
        <div style={{ position: 'relative' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', backgroundColor: (isListening || isAISpeaking) ? '#eef2f5' : (timeLeft <= 10 ? '#ffe3e3' : '#eef2f5'), borderRadius: '8px', color: (isListening || isAISpeaking) ? '#333' : (timeLeft <= 10 ? 'red' : 'black'), fontWeight: 'bold', transition: 'background-color 0.5s' }}>
            <span>Interview in Progress</span>
            {isAISpeaking ? (
              <span style={{ animation: 'aiGlow 2s infinite', color: '#007bff' }}>🤖 AI is speaking... (Timer Paused)</span>
            ) : isListening ? (
              <span style={{ animation: 'pulse 1.5s infinite', color: '#dc3545' }}>🎙️ Listening... (Timer Paused)</span>
            ) : (
              <span>⏳ Time Left: {timeLeft}s</span>
            )}
          </div>

          <div style={{ border: '1px solid #ccc', borderRadius: '10px', padding: '15px', height: '400px', overflowY: 'auto', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, index) => {
              if (msg.content.includes('[TIME_OUT]')) return null; 
              
              return (
                <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                  <span style={{ 
                    display: 'inline-block', padding: '10px', borderRadius: '10px', 
                    backgroundColor: msg.role === 'user' ? '#007bff' : '#e2e3e5',
                    color: msg.role === 'user' ? 'white' : 'black',
                    maxWidth: '80%', textAlign: 'left'
                  }}>
                    <strong>{msg.role === 'user' ? 'You' : 'AI Interviewer'}: </strong> {msg.content}
                  </span>
                </div>
              );
            })}
            {isLoading && <div style={{ textAlign: 'left', color: 'gray' }}><em>AI is analyzing and responding...</em></div>}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <input 
              type="text" value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
              placeholder="Type or speak your answer..." 
              disabled={isLoading}
              style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
            />
            <button 
              onClick={toggleListening} disabled={isLoading || isAISpeaking}
              style={{ 
                padding: '10px', 
                backgroundColor: isListening ? '#dc3545' : (isAISpeaking ? '#ccc' : '#17a2b8'), 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px', 
                cursor: (isLoading || isAISpeaking) ? 'not-allowed' : 'pointer', 
                transition: '0.3s',
                animation: isListening ? 'pulse 1.5s infinite' : 'none',
                minWidth: '120px'
              }}>
              {isListening ? '🛑 Stop Mic' : '🎤 Speak'}
            </button>
            <button 
              onClick={handleSend} disabled={isLoading}
              style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Send
            </button>
          </div>
        </div>
      )}

      {(appStage === 'EVALUATED' || appStage === 'ENDED') && evaluation && (
        <div style={{ padding: '20px', backgroundColor: '#eef2f5', borderRadius: '10px' }}>
          <h2 style={{ textAlign: 'center', color: '#28a745', marginBottom: '5px' }}>Interview Report</h2>
          <h4 style={{ textAlign: 'center', marginTop: '0', color: '#555' }}>Category: {evaluation.category}</h4>
          
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <h1 style={{ fontSize: '56px', margin: '0' }}>{evaluation.readiness_score}/100</h1>
            <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Overall Readiness Score</p>
          </div>

          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderTop: '4px solid #17a2b8' }}>
            <h3 style={{ marginTop: 0, color: '#17a2b8' }}>📊 Performance Breakdown</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' }}>
              {Object.entries(evaluation.performance_breakdown).map(([skill, score], i) => (
                <div key={i} style={{ backgroundColor: '#f8f9fa', padding: '10px 15px', borderRadius: '5px', textAlign: 'center', minWidth: '120px' }}>
                  <strong style={{ display: 'block', fontSize: '14px', color: '#555' }}>{skill.replace('_', ' ')}</strong>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: score >= 80 ? '#28a745' : score >= 60 ? '#ffc107' : '#dc3545' }}>
                    {score}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #28a745' }}>
              <h3 style={{ marginTop: 0, color: '#28a745' }}>💪 Strengths</h3>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {evaluation.strengths.map((str, i) => <li key={i} style={{ marginBottom: '5px' }}>{str}</li>)}
              </ul>
            </div>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #dc3545' }}>
              <h3 style={{ marginTop: 0, color: '#dc3545' }}>⚠️ Weaknesses</h3>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {evaluation.weaknesses.map((weak, i) => <li key={i} style={{ marginBottom: '5px' }}>{weak}</li>)}
              </ul>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #ffc107' }}>
             <h3 style={{ marginTop: 0, color: '#d39e00' }}>💡 Actionable Feedback</h3>
             <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {evaluation.actionable_feedback.map((fb, i) => <li key={i} style={{ marginBottom: '5px' }}>{fb}</li>)}
             </ul>
          </div>

          <button 
            onClick={() => {
              window.speechSynthesis.cancel();
              window.location.reload();
            }} 
            style={{ width: '100%', marginTop: '20px', padding: '12px', backgroundColor: '#343a40', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}>
            Start New Interview
          </button>
        </div>
      )}
    </div>
  );
}

export default App;