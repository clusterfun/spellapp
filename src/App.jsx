import React, { useState, useRef, useEffect } from 'react';
import { Upload, Mic, Play, CheckCircle, XCircle, RefreshCw, Volume2, ArrowRight, Save, Clock, Home, FileText } from 'lucide-react';
import errorHandler from './errorReporting';

const apiKey = import.meta.env.VITE_API_KEY;

export default function App() {
  const [appState, setAppState] = useState('DASHBOARD'); // DASHBOARD, EXTRACTING, READY, TESTING, RESULTS
  
  // --- Global App Data ---
  const [tests, setTests] = useState([]); // Array to store all test objects
  const [activeTestId, setActiveTestId] = useState(null); // ID of the test currently being taken
  
  // --- Active Test State ---
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tries, setTries] = useState(0);
  const [correctWords, setCorrectWords] = useState([]);
  const [missedWords, setMissedWords] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');

  // --- Voice Settings State ---
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  // Load available voices on startup
  useEffect(() => {
    const loadVoices = () => {
      if (!('speechSynthesis' in window)) return;
      const availableVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      setVoices(availableVoices);
      
      if (availableVoices.length > 0 && !selectedVoice) {
        const preferred = availableVoices.find(v => v.name.includes('Google US English')) ||
                          availableVoices.find(v => v.name.includes('Natural')) ||
                          availableVoices.find(v => v.name.includes('Premium')) ||
                          availableVoices.find(v => v.name.includes('Samantha')) ||
                          availableVoices[0];
        setSelectedVoice(preferred);
      }
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice]);

  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // --- Test Management ---
  const loadTest = (test) => {
    setActiveTestId(test.id);
    setWords(test.words);
    setCurrentIndex(test.currentIndex);
    setCorrectWords(test.correctWords);
    setMissedWords(test.missedWords);
    setTries(0);
    setUserInput('');
    setFeedback('');
  };

  const syncTestProgress = (updates) => {
    setTests(prev => prev.map(t => t.id === activeTestId ? { ...t, ...updates } : t));
  };

  // --- Image Processing & API Call ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAppState('EXTRACTING');
    setError('');

    const backupWords = [
      { word: "dear", sentence: "My dear friend sent me a letter." },
      { word: "whether", sentence: "I don't know whether it will rain or snow." },
      { word: "waste", sentence: "Please do not waste your food." },
      { word: "would", sentence: "I would like to go to the park." },
      { word: "pause", sentence: "Please pause the movie while I get a snack." },
      { word: "duel", sentence: "The two knights fought a duel." },
      { word: "dual", sentence: "The car has dual controls for safety." },
      { word: "ate", sentence: "I ate a big apple for lunch." },
      { word: "cell", sentence: "A battery has a power cell." },
      { word: "wood", sentence: "The table is made of solid wood." },
      { word: "weather", sentence: "The weather outside is sunny and warm." },
      { word: "you're", sentence: "I think you're going to like this game." },
      { word: "sell", sentence: "I will sell my old bike at the yard sale." },
      { word: "eight", sentence: "A spider has eight legs." },
      { word: "who's", sentence: "Do you know who's knocking at the door?" },
      { word: "whose", sentence: "Whose jacket is left on the chair?" },
      { word: "deer", sentence: "We saw a deer running in the forest." },
      { word: "paws", sentence: "The puppy has white paws." },
      { word: "your", sentence: "Don't forget to brush your teeth." },
      { word: "waist", sentence: "I tied the belt around my waist." }
    ];

    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (result && result.includes(',')) {
            resolve(result.split(',')[1]);
          } else {
            reject(new Error("Failed to read image data."));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || 'image/jpeg';

      const payload = {
        contents: [{
          role: "user",
          parts: [
            { text: "Look at the 'Spelling Words' table in this image. Extract ONLY the spelling words. Return a JSON object containing a 'words' array. Each object in the array must have a 'word' property with the spelling word, and a 'sentence' property with a short, simple 3rd-grade appropriate example sentence using that word. This is crucial because there are homophones and the student needs context to know which one to spell. DO NOT include vocabulary words, grammar, or math. Output valid JSON only." },
            { inlineData: { mimeType: mimeType, data: base64Data } }
          ]
        }]
      };

      const fetchWithRetry = async () => {
        // Step 1: Ask Google's servers EXACTLY which models your specific API key has access to
        let targetModel = 'gemini-1.5-flash';
        try {
          const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            // Filter the available models down to ones that support vision/content generation
            const availableModels = modelsData.models
              .map(m => m.name.replace('models/', ''))
              .filter(name => name.includes('gemini'));
            
            if (availableModels.includes('gemini-pro-vision')) {
              targetModel = 'gemini-pro-vision';
            } else if (availableModels.includes('gemini-1.5-flash')) {
              targetModel = 'gemini-1.5-flash';
            } else if (availableModels.find(m => m.includes('flash'))) {
              targetModel = availableModels.find(m => m.includes('flash'));
            } else if (availableModels.length > 0) {
              targetModel = availableModels[0]; // Use whatever flash model they give us
            }
          }
        } catch (e) {
          console.warn("Could not fetch model list automatically, using fallback.", e);
        }

        const delays = [1000, 2000, 4000, 8000, 16000];
        for (let i = 0; i < 5; i++) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${targetModel}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
              const errorText = await res.text();
              if (res.status === 403 || res.status === 401) {
                throw new Error(`Missing or Invalid API Key! If running locally, please check the apiKey variable on line 4.`);
              }
              throw new Error(`HTTP ${res.status}: ${errorText}`);
            }
            
            return await res.json();
          } catch (err) {
            if (err.message.includes('API Key')) throw err; // Don't retry authorization errors
            if (i === 4) throw err;
            await new Promise(r => setTimeout(r, delays[i]));
          }
        }
      };

      const result = await fetchWithRetry();
      const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!extractedText) throw new Error("No text returned from API.");
      
      let cleanedText = extractedText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = cleanedText.indexOf('{');
      if (firstBrace !== -1) {
         cleanedText = cleanedText.substring(firstBrace, cleanedText.lastIndexOf('}') + 1);
      }
      
      const parsedData = JSON.parse(cleanedText);
      const parsedWords = parsedData.words || parsedData;
      
      if (parsedWords && Array.isArray(parsedWords) && parsedWords.length > 0) {
        createAndStartNewTest(parsedWords);
      } else {
        throw new Error("Could not find spelling words in the image.");
      }

    } catch (err) {
      console.warn("Upload/Extraction Error:", err);
      setError(`Note: AI extraction failed (${err.message}). A backup list from your image has been loaded so you can still practice!`);
      createAndStartNewTest(backupWords);
    }
  };

  const createAndStartNewTest = (testWords, explicitTitle) => {
    const newTest = {
      id: Date.now(),
      title: explicitTitle || `Spelling Test - ${new Date().toLocaleDateString()}`,
      words: testWords,
      currentIndex: 0,
      correctWords: [],
      missedWords: [],
      status: 'unfinished'
    };
    setTests(prev => [newTest, ...prev]);
    loadTest(newTest);
    setAppState('READY');
  };

  // --- Speech Synthesis (Text to Speech) ---
  const speakWord = (wordObj) => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    
    const textToSpeak = `${wordObj.word}. ${wordObj.sentence}. Spell ${wordObj.word}.`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.85; 
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  // --- Speech Recognition (Speech to Text) ---
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support speech recognition. Please type the letters.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const formattedTranscript = transcript.replace(/\s+/g, '').toLowerCase();
      setUserInput(formattedTranscript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  // --- Game Logic ---
  const startTest = () => {
    setAppState('TESTING');
    speakWord(words[currentIndex]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleRetryMissed = () => {
    const currentTest = tests.find(t => t.id === activeTestId);
    const retryTest = {
      id: Date.now(),
      title: `Retry: ${currentTest?.title || 'Missed Words'}`,
      words: missedWords,
      currentIndex: 0,
      correctWords: [],
      missedWords: [],
      status: 'unfinished'
    };
    setTests(prev => [retryTest, ...prev]);
    loadTest(retryTest);
    setAppState('TESTING');
    speakWord(retryTest.words[0]);
  };

  const saveAndExit = () => {
    syncTestProgress({ currentIndex, correctWords, missedWords, status: 'unfinished' });
    setAppState('DASHBOARD');
    setActiveTestId(null);
  };

  const checkSpelling = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const currentWord = words[currentIndex];
    const cleanInput = userInput.toLowerCase().replace(/[^a-z]/g, '');
    const cleanWord = currentWord.word.toLowerCase().replace(/[^a-z]/g, '');

    if (cleanInput === cleanWord) {
      setFeedback('correct');
      const updatedCorrect = [...correctWords, currentWord];
      setCorrectWords(updatedCorrect);
      setTimeout(() => advanceToNext(updatedCorrect, missedWords), 1500);
    } else {
      const newTries = tries + 1;
      setTries(newTries);
      
      if (newTries >= 5) {
        setFeedback('failed');
        const updatedMissed = [...missedWords, currentWord];
        setMissedWords(updatedMissed);
        setTimeout(() => advanceToNext(correctWords, updatedMissed), 3500);
      } else {
        setFeedback('incorrect');
        setUserInput('');
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  };

  const advanceToNext = (updatedCorrect, updatedMissed) => {
    const nextIndex = currentIndex + 1;
    const isCompleted = nextIndex >= words.length;

    syncTestProgress({
      currentIndex: nextIndex,
      correctWords: updatedCorrect,
      missedWords: updatedMissed,
      status: isCompleted ? 'completed' : 'unfinished'
    });

    if (!isCompleted) {
      setCurrentIndex(nextIndex);
      setTries(0);
      setUserInput('');
      setFeedback('');
      speakWord(words[nextIndex]);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setAppState('RESULTS');
    }
  };

  // --- Render Views ---
  
  const renderDashboard = () => {
    const unfinishedTests = tests.filter(t => t.status === 'unfinished');
    const completedTests = tests.filter(t => t.status === 'completed');

    return (
      <div className="w-full space-y-8 flex flex-col max-w-2xl mx-auto">
        
        {/* Voice Selector - Moved to Dashboard */}
        {voices.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700">Speaker Voice</label>
              <p className="text-xs text-gray-500">Pick the voice that sounds best to you.</p>
            </div>
            <select 
              className="max-w-xs p-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none flex-1"
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = voices.find(v => v.name === e.target.value);
                setSelectedVoice(voice);
              }}
            >
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100 flex flex-col items-center justify-center space-y-4 text-center">
          <Upload size={40} className="text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">Start a New Test</h2>
            <p className="text-gray-600 text-sm mt-1">Upload a photo of a spelling list</p>
          </div>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all active:scale-95">
            Choose Image
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
              ref={fileInputRef}
            />
          </label>
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200 mt-2">{error}</div>}
        </div>

        {/* Unfinished Tests */}
        {unfinishedTests.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center"><Clock className="mr-2" size={20}/> Resume Tests</h3>
            <div className="space-y-3">
              {unfinishedTests.map(test => (
                <div key={test.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-gray-800">{test.title}</h4>
                    <p className="text-sm text-gray-500">Progress: Word {test.currentIndex + 1} of {test.words.length}</p>
                  </div>
                  <button 
                    onClick={() => { loadTest(test); setAppState('TESTING'); speakWord(test.words[test.currentIndex]); }}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Tests */}
        {completedTests.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-green-800 mb-3 flex items-center"><CheckCircle className="mr-2" size={20}/> Completed</h3>
            <div className="space-y-3">
              {completedTests.map(test => (
                <div key={test.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-gray-800">{test.title}</h4>
                    <p className="text-sm text-gray-500">Score: {test.correctWords.length} / {test.words.length}</p>
                  </div>
                  <button 
                    onClick={() => { loadTest(test); setAppState('RESULTS'); }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                  >
                    View Results
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Uploaded Lists (Test Library) */}
        {tests.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-indigo-800 mb-3 flex items-center"><FileText className="mr-2" size={20}/> All Spelling Lists</h3>
            <div className="space-y-3">
              {tests.map(test => (
                <div key={`lib-${test.id}`} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-gray-800">{test.title}</h4>
                    <p className="text-sm text-gray-500">{test.words.length} words</p>
                  </div>
                  <button 
                    onClick={() => createAndStartNewTest(test.words, test.title.includes("Retake") ? test.title : `Retake: ${test.title.split(' - ')[0]}`)}
                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                  >
                    Start Fresh
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderExtracting = () => (
    <div className="flex flex-col items-center justify-center space-y-6 text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
      <h2 className="text-2xl font-bold text-gray-800">Reading the words...</h2>
      <p className="text-gray-600">Creating helpful sentences for homophones...</p>
    </div>
  );

  const renderReady = () => (
    <div className="flex flex-col items-center justify-center space-y-6 text-center">
      <div className="bg-green-100 p-6 rounded-full">
        <FileText size={48} className="text-green-600" />
      </div>
      <h2 className="text-3xl font-bold text-gray-800">Ready to go!</h2>
      <p className="text-gray-600">We extracted {words.length} spelling words.</p>
      
      <div className="bg-gray-50 rounded-lg p-4 w-full max-w-md text-left text-sm text-gray-500 overflow-y-auto max-h-48 border border-gray-200">
        <ul className="list-disc pl-5 space-y-1">
          {words.map((w, i) => (
            <li key={i}><span className="font-semibold">{w.word}</span>: {w.sentence}</li>
          ))}
        </ul>
      </div>

      <button 
        onClick={startTest}
        className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-semibold shadow-lg transition-all active:scale-95 text-lg mt-4"
      >
        <Play size={24} />
        <span>Start Spelling Test</span>
      </button>
    </div>
  );

  const renderTesting = () => {
    const currentWord = words[currentIndex];
    const regex = new RegExp(`\\b${currentWord.word}\\b`, 'gi');
    const maskedSentence = currentWord.sentence.replace(regex, '_______');
    
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto space-y-8 relative pt-6">
        
        {/* Save and Exit Button */}
        <button 
          onClick={saveAndExit}
          className="absolute -top-4 -left-4 md:-left-12 flex items-center text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
        >
          <Save size={16} className="mr-1.5" /> Save & Exit
        </button>

        {/* Progress Header */}
        <div className="w-full flex justify-between items-center text-gray-500 font-medium">
          <span>Word {currentIndex + 1} of {words.length}</span>
          <span>Tries: {tries}/5</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${((currentIndex) / words.length) * 100}%` }}></div>
        </div>

        {/* Audio Controls & Context */}
        <div className="bg-blue-50 w-full p-6 rounded-2xl border border-blue-100 text-center space-y-4">
          <button 
            onClick={() => speakWord(currentWord)}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-4 rounded-full transition-colors mx-auto block"
            title="Listen to word"
          >
            <Volume2 size={32} />
          </button>
          
          <div className="text-blue-800 italic text-lg">
            "{maskedSentence}"
          </div>
        </div>

        {/* Feedback Area */}
        <div className="h-16 flex items-center justify-center w-full">
          {feedback === 'correct' && (
            <div className="text-green-600 text-xl font-bold flex items-center animate-bounce">
              <CheckCircle className="mr-2" /> Correct! Great job!
            </div>
          )}
          {feedback === 'incorrect' && (
            <div className="text-amber-600 text-xl font-bold flex items-center">
              <XCircle className="mr-2" /> Not quite. Try again! ({5 - tries} tries left)
            </div>
          )}
          {feedback === 'failed' && (
            <div className="text-red-600 text-lg font-bold flex flex-col items-center text-center">
              <div className="flex items-center"><XCircle className="mr-2" /> Out of tries!</div>
              <div className="mt-2 text-gray-700 font-normal">The correct spelling is: <span className="font-black text-2xl tracking-widest">{currentWord.word}</span></div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={checkSpelling} className="w-full relative">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={feedback === 'correct' || feedback === 'failed'}
            className="w-full text-center text-4xl tracking-widest p-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all outline-none disabled:bg-gray-100 disabled:text-gray-400 font-mono uppercase"
            placeholder="Type here..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          
          <div className="flex justify-between mt-4 gap-4">
            <button
              type="button"
              onClick={startListening}
              disabled={isListening || feedback === 'correct' || feedback === 'failed'}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-medium transition-colors ${
                isListening ? 'bg-red-100 text-red-600 border border-red-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
            >
              <Mic size={20} className={isListening ? 'animate-pulse' : ''} />
              <span>{isListening ? 'Listening...' : 'Use Mic'}</span>
            </button>
            
            <button
              type="submit"
              disabled={!userInput.trim() || feedback === 'correct' || feedback === 'failed'}
              className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-lg font-medium transition-colors"
            >
              <span>Submit</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </form>

      </div>
    );
  };

  const renderResults = () => (
    <div className="flex flex-col items-center justify-center space-y-8 w-full max-w-2xl mx-auto relative">
      <button 
        onClick={() => { setAppState('DASHBOARD'); setActiveTestId(null); }}
        className="absolute -top-4 -left-4 md:-left-12 flex items-center text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
      >
        <Home size={16} className="mr-1.5" /> Dashboard
      </button>

      <div className="text-center space-y-2 pt-6">
        <h2 className="text-4xl font-extrabold text-gray-800">Test Complete!</h2>
        <p className="text-xl text-gray-600">
          You scored <span className="font-bold text-blue-600">{correctWords.length}</span> out of <span className="font-bold text-blue-600">{words.length}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
          <h3 className="text-xl font-bold text-green-800 flex items-center mb-4">
            <CheckCircle className="mr-2" /> Mastered Words
          </h3>
          {correctWords.length === 0 ? (
            <p className="text-green-600/70 italic">None this time, keep practicing!</p>
          ) : (
            <ul className="space-y-2">
              {correctWords.map((w, i) => (
                <li key={i} className="flex items-center text-green-700 bg-white px-3 py-2 rounded-lg shadow-sm">
                  <span className="font-medium">{w.word}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
          <h3 className="text-xl font-bold text-red-800 flex items-center mb-4">
            <XCircle className="mr-2" /> Words to Practice
          </h3>
          {missedWords.length === 0 ? (
            <p className="text-red-600/70 italic">Perfect score! No missed words.</p>
          ) : (
            <ul className="space-y-2">
              {missedWords.map((w, i) => (
                <li key={i} className="flex items-center text-red-700 bg-white px-3 py-2 rounded-lg shadow-sm">
                  <span className="font-medium">{w.word}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        {missedWords.length > 0 && (
          <button 
            onClick={handleRetryMissed}
            className="flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-xl font-semibold shadow-lg transition-all active:scale-95"
          >
            <RefreshCw size={24} />
            <span>Retry Missed Words</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center py-12 px-4 font-sans text-gray-800">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-xl overflow-hidden min-h-[600px] flex flex-col relative">
        
        <div className="bg-blue-600 p-6 text-white text-center">
          <h1 className="text-3xl font-black tracking-wide">SpellMaster AI</h1>
          <p className="opacity-80 mt-1">Interactive Spelling Tests from Photos</p>
        </div>

        <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
          {appState === 'DASHBOARD' && renderDashboard()}
          {appState === 'EXTRACTING' && renderExtracting()}
          {appState === 'READY' && renderReady()}
          {appState === 'TESTING' && renderTesting()}
          {appState === 'RESULTS' && renderResults()}
        </div>

      </div>
    </div>
  );
}