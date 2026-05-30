import { useState } from 'react';

function App() {
  // App flow handle cheyadaniki stages: 'SETUP', 'CHATTING', 'ENDED', 'EVALUATED'
  const [appStage, setAppStage] = useState('SETUP');
  
  const [jobDescription, setJobDescription] = useState('');
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [evaluation, setEvaluation] = useState(null);

  // 1. Start Interview (Setup -> Chatting)
  const startInterview = () => {
    if (!jobDescription.trim()) return alert("Please enter a Job Description");
    setMessages([
      { role: 'assistant', content: `Hello! I am your interviewer today. I've reviewed the job description you provided. Let's start by having you introduce yourself briefly.` }
    ]);
    setAppStage('CHATTING');
  };

  // 2. Chat Logic (Dynamic, No Limits)
  const sendMessage = async () => {
    if (!userInput.trim()) return;

    const newUserMessage = { role: 'user', content: userInput };
    const updatedHistory = [...messages, newUserMessage];
    
    setMessages(updatedHistory);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          job_description: jobDescription, 
          history: updatedHistory 
        }), 
      });

      const data = await response.json();
      
      if (data.ai_response) {
        let aiText = data.ai_response;
        let isInterviewOver = false;

        // AI interview end chesthe token vasthundi
        if (aiText.includes('[END_INTERVIEW]')) {
          aiText = aiText.replace('[END_INTERVIEW]', '').trim(); 
          isInterviewOver = true;
        }

        setMessages([...updatedHistory, { role: 'assistant', content: aiText }]);

        // Token vasthe App Stage ni 'ENDED' ki marchutham (Text box mayam avthundi)
        if (isInterviewOver) {
           setAppStage('ENDED');
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setIsLoading(false);
  };

  // 3. Manual ga Feedback fetch cheyadam (Ended -> Evaluated)
  const getFeedback = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          job_description: jobDescription, 
          history: messages 
        }), 
      });

      const data = await response.json();
      const resultData = JSON.parse(data.evaluation);
      setEvaluation(resultData); 
      setAppStage('EVALUATED');
      
    } catch (error) {
      console.error("Evaluation error:", error);
      alert("Evaluation failed. Make sure backend is returning correct JSON.");
    }
    setIsLoading(false);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '700px', margin: 'auto' }}>
      <h2 style={{ textAlign: 'center' }}>🤖 AI Mock Interviewer</h2>

      {/* STAGE 1: SETUP SCREEN */}
      {appStage === 'SETUP' && (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#f9f9f9' }}>
          <h3>Interview Setup</h3>
          <p>Paste the Job Description (JD) OR your Target Role & Skills (e.g., TCS NQT) below:</p>
          <textarea 
            rows="6" 
            style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px' }}
            // Placeholder update chesam
            placeholder="e.g., 'React Developer JD...' OR 'TCS NQT Interview, focus on Python, OOPS, and DBMS'"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
          <button 
            onClick={startInterview}
            style={{ width: '100%', padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Start Interview
          </button>
        </div>
      )}

      {/* STAGE 2 & 3: CHATTING OR ENDED SCREEN */}
      {(appStage === 'CHATTING' || appStage === 'ENDED') && (
        <>
          <div style={{ border: '1px solid #ccc', borderRadius: '10px', padding: '15px', height: '400px', overflowY: 'auto', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                <span style={{ 
                  display: 'inline-block', padding: '10px', borderRadius: '10px', 
                  backgroundColor: msg.role === 'user' ? '#007bff' : '#e2e3e5',
                  color: msg.role === 'user' ? 'white' : 'black',
                  maxWidth: '80%', textAlign: 'left'
                }}>
                  <strong>{msg.role === 'user' ? 'You' : 'AI'}: </strong> {msg.content}
                </span>
              </div>
            ))}
            {isLoading && <div style={{ textAlign: 'left', color: 'gray' }}><em>Processing...</em></div>}
          </div>

          {/* Chat box normal ga unnapudu */}
          {appStage === 'CHATTING' && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <input 
                type="text" value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
                placeholder="Type your answer here..." 
                style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
              />
              <button 
                onClick={sendMessage} disabled={isLoading}
                style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Send
              </button>
            </div>
          )}

          {/* AI Interview End chesaka text box hide ayyi ee button vasthundi */}
          {appStage === 'ENDED' && (
            <div style={{ marginTop: '15px', textAlign: 'center' }}>
              <button 
                onClick={getFeedback} disabled={isLoading}
                style={{ padding: '12px 24px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                Get Judgment / Feedback 📊
              </button>
            </div>
          )}
        </>
      )}

      {/* STAGE 4: EVALUATED SCREEN */}
      {appStage === 'EVALUATED' && evaluation && (
        <div style={{ padding: '20px', backgroundColor: '#eef2f5', borderRadius: '10px' }}>
          <h2 style={{ textAlign: 'center', color: '#28a745' }}>Interview Feedback</h2>
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            {/* margin bottom add chesthunnam overlapping apadaniki */}
            <h1 style={{ fontSize: '48px', margin: '0 0 10px 0' }}>{evaluation.score}/100</h1>
            <p style={{ margin: '0', fontSize: '18px', color: '#555' }}>Overall Fit for Role</p>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #007bff' }}>
              <h3 style={{ marginTop: 0, color: '#007bff' }}>💪 Strengths</h3>
              <ul style={{ paddingLeft: '20px' }}>
                {evaluation.strengths.map((str, i) => <li key={i} style={{ marginBottom: '5px' }}>{str}</li>)}
              </ul>
            </div>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #ffc107' }}>
              <h3 style={{ marginTop: 0, color: '#d39e00' }}>📈 Areas to Improve</h3>
              <ul style={{ paddingLeft: '20px' }}>
                {evaluation.improvements.map((imp, i) => <li key={i} style={{ marginBottom: '5px' }}>{imp}</li>)}
              </ul>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ width: '100%', marginTop: '20px', padding: '12px', backgroundColor: '#343a40', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Start New Interview
          </button>
        </div>
      )}
    </div>
  );
}

export default App;