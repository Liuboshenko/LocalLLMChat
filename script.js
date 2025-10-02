// Configuration - Replace with your actual endpoint
const CONFIG = {
    apiUrl: 'http://10.27.192.116:8080/v1/chat/completions',
    apiKey: 'not-needed',  // Optional API key
    model: 'qwen3-14b',  // Default model
    initialSystemPrompt: 'think like an architect of large language models. Use the <think> tag for your reasoning and close it </think> before the main answer.' // Updated system prompt
};

// State management
const state = {
    messages: [],
    chatHistory: [],
    currentChatId: null,
    isGenerating: false,
    theme: 'light',  // Default theme
    attachedImages: [], //array of base64 strings
};

// DOM Elements
const chatContainer = document.getElementById('chat-container');
const welcomeScreen = document.getElementById('welcome-screen');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const newChatButton = document.getElementById('new-chat-btn');
const historyContainer = document.getElementById('history-container');
const themeSelect = document.getElementById('theme-select');
const clearStorageBtn = document.getElementById('clear-storage-btn');
const confirmationModal = document.getElementById('confirmation-modal');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
//
const attachButton = document.getElementById('attach-button');
const fileInput = document.getElementById('file-input');
const imagePreview = document.getElementById('image-preview');

// Initialize app
function initApp() {
    loadSettings();
    loadChatHistory();
    createNewChat();
    setupEventListeners();
    autoResizeTextarea();
    applyTheme(state.theme);
}

// Load settings from localStorage
function loadSettings() {
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            state.theme = savedTheme;
            themeSelect.value = savedTheme;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save settings to localStorage
function saveSettings() {
    try {
        localStorage.setItem('theme', state.theme);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Apply theme to document
function applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    state.theme = themeName;
    saveSettings();
}

// Load chat history from localStorage
function loadChatHistory() {
    try {
        const savedHistory = localStorage.getItem('chatHistory');
        if (savedHistory) {
            state.chatHistory = JSON.parse(savedHistory);
            renderChatHistory();
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Save chat history to localStorage
function saveChatHistory() {
    try {
        localStorage.setItem('chatHistory', JSON.stringify(state.chatHistory));
        renderChatHistory();
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

// Render chat history in sidebar
function renderChatHistory() {
    historyContainer.innerHTML = '';
    state.chatHistory.forEach(chat => {
        const historyItem = document.createElement('div');
        historyItem.className = 'chat-history-item';
        historyItem.textContent = chat.title || 'New Chat';
        historyItem.dataset.chatId = chat.id;
        historyItem.addEventListener('click', () => loadChat(chat.id));
        historyContainer.appendChild(historyItem);
    });
}

// Create a new chat
function createNewChat() {
    state.messages = [];
    state.attachedImages = [];
    imagePreview.innerHTML = '';
    state.currentChatId = Date.now().toString();
    
    // Add system message
    state.messages.push({
        role: 'system',
        content: CONFIG.initialSystemPrompt
    });

    // Add to chat history
    state.chatHistory.unshift({
        id: state.currentChatId,
        title: 'New Chat',
        messages: [...state.messages]
    });
    
    saveChatHistory();
    clearChatUI();
    userInput.focus();
}

// Load a chat from history
function loadChat(chatId) {
    state.attachedImages = [];
    imagePreview.innerHTML = '';
    const chat = state.chatHistory.find(c => c.id === chatId);
    if (chat) {
        state.currentChatId = chat.id;
        state.messages = [...chat.messages];
        clearChatUI();
        
        // Display chat messages (excluding system message)
        state.messages.slice(1).forEach(msg => {
            if (msg.role === 'user') {
                appendMessageToUI('user', msg.content);
            } else {
                // Parse for <think> tags
                const thinkMatch = msg.content.match(/<think>(.*?)<\/think>(.*)/s);
                if (thinkMatch) {
                    const reasoning = thinkMatch[1].trim();
                    const answer = thinkMatch[2].trim();
                    appendAssistantMessageToUI(reasoning, answer);
                } else {
                    appendAssistantMessageToUI('', msg.content);
                }
            }
        });
        
        userInput.focus();
    }
}

// Clear chat UI
function clearChatUI() {
    chatContainer.innerHTML = '';
    welcomeScreen.style.display = 'none';
}

// Update chat title based on the first user message
function updateChatTitle(userMessage) {
    const chatIndex = state.chatHistory.findIndex(chat => chat.id === state.currentChatId);
    if (chatIndex !== -1) {
        if (state.chatHistory[chatIndex].title === 'New Chat') {
            const title = userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : '');
            state.chatHistory[chatIndex].title = title;
            saveChatHistory();
        }
    }
}

// Set up event listeners
function setupEventListeners() {
    themeSelect.addEventListener('change', (event) => {
        applyTheme(event.target.value);
    });
    
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    
    userInput.addEventListener('input', () => {
        sendButton.disabled = userInput.value.trim() === '' || state.isGenerating;
        autoResizeTextarea();
    });
    
    newChatButton.addEventListener('click', createNewChat);
    
    clearStorageBtn.addEventListener('click', () => {
        showConfirmationModal();
    });
    
    modalCancel.addEventListener('click', hideConfirmationModal);
    modalConfirm.addEventListener('click', clearAllData);
    
    confirmationModal.addEventListener('click', (event) => {
        if (event.target === confirmationModal) {
            hideConfirmationModal();
        }
    });
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && confirmationModal.classList.contains('active')) {
            hideConfirmationModal();
        }
    });
    
    // Добавленные обработчики для прикрепления изображений
    attachButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    const base64 = await fileToBase64(file);
                    state.attachedImages.push(base64);
                    displayImagePreview(base64);
                }
            }
            event.target.value = ''; // Reset input for re-selection
        }
    });
}

// Show confirmation modal
function showConfirmationModal() {
    confirmationModal.classList.add('active');
}

// Hide confirmation modal
function hideConfirmationModal() {
    confirmationModal.classList.remove('active');
}

// Clear all localStorage data
function clearAllData() {
    try {
        localStorage.clear();
        state.chatHistory = [];
        state.theme = 'light';
        
        themeSelect.value = 'light';
        applyTheme('light');
        renderChatHistory();
        createNewChat();
        
        hideConfirmationModal();
        
        appendMessageToUI('assistant', 'All chat history and settings have been cleared successfully.');
    } catch (error) {
        console.error('Error clearing localStorage:', error);
        appendMessageToUI('assistant', 'There was an error clearing your data. Please try again.');
    }
}

// Auto-resize textarea as user types
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
}

// Append a user message to the UI
function appendMessageToUI(role, content) {
    if (role !== 'user') return; // Handle assistant messages separately
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const avatar = document.createElement('div');
    avatar.className = `avatar ${role}-avatar`;
    avatar.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content markdown';
    messageContent.innerHTML = formatMarkdown(content);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Append assistant message with reasoning and answer panels
function appendAssistantMessageToUI(reasoning, answer) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar ai-avatar';
    avatar.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"></path></svg>';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';
    
    // Reasoning panel (only if reasoning exists)
    if (reasoning) {
        const reasoningPanel = document.createElement('div');
        reasoningPanel.className = 'reasoning-panel';
        
        const reasoningHeader = document.createElement('div');
        reasoningHeader.className = 'reasoning-header';
        reasoningHeader.innerHTML = '<strong>Рассуждения модели:</strong><span class="toggle-icon">-</span>';
        
        const reasoningContent = document.createElement('div');
        reasoningContent.className = 'reasoning-content markdown';
        reasoningContent.innerHTML = formatMarkdown(reasoning);
        reasoningContent.style.display = 'block';
        
        reasoningPanel.appendChild(reasoningHeader);
        reasoningPanel.appendChild(reasoningContent);
        
        reasoningHeader.addEventListener('click', () => {
            if (reasoningContent.style.display === 'none') {
                reasoningContent.style.display = 'block';
                reasoningHeader.querySelector('.toggle-icon').textContent = '-';
            } else {
                reasoningContent.style.display = 'none';
                reasoningHeader.querySelector('.toggle-icon').textContent = '+';
            }
        });
        
        contentWrapper.appendChild(reasoningPanel);
    }
    
    // Answer panel
    const answerPanel = document.createElement('div');
    answerPanel.className = 'answer-panel markdown';
    answerPanel.innerHTML = '<strong>Ответ:</strong><div class="answer-content">' + formatMarkdown(answer) + '</div>';
    
    contentWrapper.appendChild(answerPanel);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentWrapper);
    chatContainer.appendChild(messageDiv);
    
    addCopyButtons(messageDiv);
    renderMath(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Create empty assistant message container for streaming
function createStreamingAssistantContainer() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar ai-avatar';
    avatar.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"></path></svg>';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';
    
    // Reasoning panel
    const reasoningPanel = document.createElement('div');
    reasoningPanel.className = 'reasoning-panel';
    
    const reasoningHeader = document.createElement('div');
    reasoningHeader.className = 'reasoning-header';
    reasoningHeader.innerHTML = '<strong>Рассуждения модели:</strong><span class="toggle-icon">-</span>';
    
    const reasoningContent = document.createElement('div');
    reasoningContent.className = 'reasoning-content markdown';
    reasoningContent.style.display = 'block';
    
    reasoningPanel.appendChild(reasoningHeader);
    reasoningPanel.appendChild(reasoningContent);
    
    reasoningHeader.addEventListener('click', () => {
        if (reasoningContent.style.display === 'none') {
            reasoningContent.style.display = 'block';
            reasoningHeader.querySelector('.toggle-icon').textContent = '-';
        } else {
            reasoningContent.style.display = 'none';
            reasoningHeader.querySelector('.toggle-icon').textContent = '+';
        }
    });
    
    // Answer panel
    const answerPanel = document.createElement('div');
    answerPanel.className = 'answer-panel markdown';
    answerPanel.innerHTML = '<strong>Ответ:</strong><div class="answer-content"></div>';
    
    contentWrapper.appendChild(reasoningPanel);
    contentWrapper.appendChild(answerPanel);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentWrapper);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return {
        container: messageDiv,
        reasoningContent,
        answerContent: answerPanel.querySelector('.answer-content')
    };
}

// Add typing indicator
function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message';
    typingDiv.id = 'typing-indicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar ai-avatar';
    avatar.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"></path></svg>';
    
    const typingContent = document.createElement('div');
    typingContent.className = 'message-content';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = 'Thinking<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    
    typingContent.appendChild(typingIndicator);
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(typingContent);
    chatContainer.appendChild(typingDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Format markdown using marked.js
function formatMarkdown(text) {
    if (typeof marked !== 'undefined') {
        return marked.parse(text);
    } else {
        // Fallback to basic markdown formatting
        text = text.replace(/```(\w*)([\s\S]*?)```/g, (match, language, code) => {
            return `<pre><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`;
        });
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        text = text.replace(/\n/g, '<br>');
        return text;
    }
}

// Escape HTML special characters
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Add copy buttons to code blocks
function addCopyButtons(container) {
    container.querySelectorAll('pre').forEach(pre => {
        if (pre.querySelector('.code-window-header')) return; // Avoid duplicates
        
        const codeContent = pre.querySelector('code');
        const textToCopy = codeContent ? codeContent.textContent.trim() : pre.textContent.trim();
        
        const header = document.createElement('div');
        header.className = 'code-window-header';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn-header';
        copyBtn.textContent = '⧉';
        copyBtn.addEventListener('click', () => {
            copyToClipboard(textToCopy, copyBtn);
        });
        
        header.appendChild(copyBtn);
        pre.insertBefore(header, pre.firstChild);
    });
}

// Copy to clipboard function
function copyToClipboard(text, btn) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = '✓';
            setTimeout(() => { btn.textContent = '⧉'; }, 2000);
        }).catch(err => {
            console.error('Clipboard error:', err);
            fallbackCopy(text, btn);
        });
    } else {
        fallbackCopy(text, btn);
    }
}

// Fallback copy function
function fallbackCopy(text, btn) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '⧉'; }, 2000);
    } catch (err) {
        console.error('Fallback copy error:', err);
    }
    document.body.removeChild(textArea);
}

// Render math using KaTeX
function renderMath(element) {
    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(element, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true }
            ],
            throwOnError: false
        });
    }
}

// Send message to the API
async function sendMessage() {
    const userMessage = userInput.value.trim();
    if (userMessage === '' || state.isGenerating) return;
    
    userInput.value = '';
    userInput.style.height = 'auto';
    sendButton.disabled = true;
    
    appendMessageToUI('user', userMessage);
    
    // Замена: Включаем изображения в content, если они прикреплены
    const userContent = [{ type: 'text', text: userMessage }];
    state.attachedImages.forEach(base64 => {
        userContent.push({ type: 'image_url', image_url: { url: base64 } });
    });
    state.messages.push({ role: 'user', content: userContent });
    
    updateChatTitle(userMessage);
    const chatIndex = state.chatHistory.findIndex(chat => chat.id === state.currentChatId);
    if (chatIndex !== -1) {
        state.chatHistory[chatIndex].messages = [...state.messages];
        saveChatHistory();
    }
    
    addTypingIndicator();
    state.isGenerating = true;
    
    try {
        const requestBody = {
            model: CONFIG.model,
            messages: state.messages,
            stream: true,
            temperature: 0.7
        };
        
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(CONFIG.apiKey && { 'Authorization': `Bearer ${CONFIG.apiKey}` })
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        removeTypingIndicator();
        
        const assistantContainer = createStreamingAssistantContainer();
        let fullResponse = '';
        let reasoningText = '';
        let answerText = '';
        let inThinkingTag = false;
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            let lastJSONEnd = 0;
            while (buffer.indexOf('\n', lastJSONEnd) !== -1) {
                const lineEnd = buffer.indexOf('\n', lastJSONEnd);
                const line = buffer.substring(lastJSONEnd, lineEnd).trim();
                lastJSONEnd = lineEnd + 1;
                
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr === '[DONE]') continue;
                    
                    try {
                        const json = JSON.parse(jsonStr);
                        const content = json.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            
                            // Handle <think> tags
                            let processedContent = content;
                            if (inThinkingTag) {
                                const endTagIndex = processedContent.indexOf('</think>');
                                if (endTagIndex !== -1) {
                                    reasoningText += processedContent.substring(0, endTagIndex);
                                    processedContent = processedContent.substring(endTagIndex + 8);
                                    inThinkingTag = false;
                                } else {
                                    reasoningText += processedContent;
                                    processedContent = '';
                                }
                            } else {
                                const startTagIndex = processedContent.indexOf('<think>');
                                if (startTagIndex !== -1) {
                                    answerText += processedContent.substring(0, startTagIndex);
                                    processedContent = processedContent.substring(startTagIndex + 7);
                                    inThinkingTag = true;
                                    const endTagIndex = processedContent.indexOf('</think>');
                                    if (endTagIndex !== -1) {
                                        reasoningText += processedContent.substring(0, endTagIndex);
                                        processedContent = processedContent.substring(endTagIndex + 8);
                                        inThinkingTag = false;
                                    } else {
                                        reasoningText += processedContent;
                                        processedContent = '';
                                    }
                                } else {
                                    answerText += processedContent;
                                }
                            }
                            
                            // Update UI with parsed Markdown
                            assistantContainer.reasoningContent.innerHTML = formatMarkdown(reasoningText);
                            assistantContainer.answerContent.innerHTML = formatMarkdown(answerText);
                            
                            renderMath(assistantContainer.reasoningContent);
                            renderMath(assistantContainer.answerContent);
                            
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    } catch (e) {
                        console.error('Error parsing JSON from stream:', e);
                    }
                }
            }
            buffer = buffer.substring(lastJSONEnd);
        }
        
        addCopyButtons(assistantContainer.container);
        
        state.messages.push({
            role: 'assistant',
            content: `<think>${reasoningText}</think>${answerText}`
        });
        
        // Очистка прикреплений после успешного ответа
        state.attachedImages = [];
        imagePreview.innerHTML = '';
        
        const updatedChatIndex = state.chatHistory.findIndex(chat => chat.id === state.currentChatId);
        if (updatedChatIndex !== -1) {
            state.chatHistory[updatedChatIndex].messages = [...state.messages];
            saveChatHistory();
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        removeTypingIndicator();
        appendAssistantMessageToUI('', 'Sorry, there was an error communicating with the API. Please check your connection and API settings.');
    } finally {
        state.isGenerating = false;
        sendButton.disabled = userInput.value.trim() === '';
        userInput.focus();
    }
}

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
// Display preview thumbnail
function displayImagePreview(base64) {
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.innerHTML = `
        <img src="${base64}" alt="Attached image">
        <span class="remove-btn">×</span>
    `;
    previewItem.querySelector('.remove-btn').addEventListener('click', () => {
        const index = state.attachedImages.indexOf(base64);
        if (index > -1) state.attachedImages.splice(index, 1);
        previewItem.remove();
    });
    imagePreview.appendChild(previewItem);
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);
