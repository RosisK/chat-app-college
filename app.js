// Global state
let currentUser = null;
let users = [];
let selectedUser = null;
let messages = [];
let isConnected = false;
let socket = null;

// DOM Elements
const appContainer = document.getElementById("app");

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  checkAuthStatus();
});

// Check if user is logged in
function checkAuthStatus() {
  const user = localStorage.getItem("user");
  if (user) {
    currentUser = JSON.parse(user);
    initializeChat();
  } else {
    showLoginForm();
  }
}

// Show login form
function showLoginForm() {
  appContainer.innerHTML = `
        <div class="auth-container">
            <h2>Login</h2>
            <div id="error" class="error-message"></div>
            <form id="loginForm" class="auth-form">
                <div>
                    <label for="username">Username:</label>
                    <input type="text" id="username" required>
                </div>
                <div>
                    <label for="password">Password:</label>
                    <input type="password" id="password" required>
                </div>
                <button type="submit">Login</button>
            </form>
            <p>Don't have an account? <a href="#" id="showRegister">Register</a></p>
        </div>
    `;

  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document
    .getElementById("showRegister")
    .addEventListener("click", showRegisterForm);
}

// Show register form
function showRegisterForm(e) {
  e.preventDefault();
  appContainer.innerHTML = `
        <div class="auth-container">
            <h2>Register</h2>
            <div id="error" class="error-message"></div>
            <form id="registerForm" class="auth-form">
                <div>
                    <label for="regUsername">Username:</label>
                    <input type="text" id="regUsername" required>
                </div>
                <div>
                    <label for="regPassword">Password:</label>
                    <input type="password" id="regPassword" required>
                </div>
                <button type="submit">Register</button>
            </form>
            <p>Already have an account? <a href="#" id="showLogin">Login</a></p>
        </div>
    `;

  document
    .getElementById("registerForm")
    .addEventListener("submit", handleRegister);
  document.getElementById("showLogin").addEventListener("click", (e) => {
    e.preventDefault();
    showLoginForm();
  });
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorElement = document.getElementById("error");

  try {
    const response = await fetch("auth.php?action=login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.error) {
      errorElement.textContent = data.error;
      return;
    }

    localStorage.setItem("user", JSON.stringify(data));
    currentUser = data;
    initializeChat();
  } catch (err) {
    errorElement.textContent = "Login failed";
    console.error(err);
  }
}

// Handle register
async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername").value;
  const password = document.getElementById("regPassword").value;
  const errorElement = document.getElementById("error");

  try {
    const response = await fetch("auth.php?action=register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.error) {
      errorElement.textContent = data.error;
      return;
    }

    localStorage.setItem("user", JSON.stringify(data));
    currentUser = data;
    initializeChat();
  } catch (err) {
    errorElement.textContent = "Registration failed";
    console.error(err);
  }
}

// Initialize chat interface
function initializeChat() {
  setupSocketConnection();
  renderChatInterface();
  loadUsers();
}

// Setup WebSocket connection
function setupSocketConnection() {
  // For vanilla JS, we'll use polling instead of WebSockets for simplicity
  // In a production environment, you would use WebSocket or Socket.io client
  isConnected = true;
  updateConnectionStatus();

  // Poll for new messages every 2 seconds
  setInterval(() => {
    if (selectedUser) {
      loadMessages(selectedUser.id);
    }
  }, 2000);
}

// Render chat interface
function renderChatInterface() {
  // Main container structure
  appContainer.innerHTML = `
        <div class="chat-container">
            <div class="sidebar">
                <h3>Welcome, ${currentUser.username}</h3>
                <button id="logoutButton">Logout</button>
                <h4>Users</h4>
                <ul id="userList" class="user-list"></ul>
            </div>
            <div class="chat-area">
                <div id="chatHeader" style="padding: 10px; border-bottom: 1px solid #ccc;">
                    ${
                      selectedUser
                        ? `<h3>Chat with ${selectedUser.username}</h3>`
                        : "<h3>Select a user to chat</h3>"
                    }
                </div>
                <div id="messagesContainer" class="messages-container"></div>
                <form id="messageForm" class="message-input-form" ${
                  !selectedUser ? 'style="display:none;"' : ""
                }>
                    <input type="text" id="messageInput" class="message-input" placeholder="Type a message..." ${
                      !selectedUser ? "disabled" : ""
                    }>
                    <button type="submit" class="send-button" ${
                      !selectedUser ? "disabled" : ""
                    }>Send</button>
                </form>
            </div>
            <div id="connectionStatus" class="connection-status ${
              isConnected ? "connected" : "disconnected"
            }">
                ${isConnected ? "Connected" : "Disconnected"}
            </div>
        </div>
    `;

  // Add event listeners
  document
    .getElementById("logoutButton")
    .addEventListener("click", handleLogout);
  document
    .getElementById("messageForm")
    .addEventListener("submit", handleSendMessage);

  // Render the user list separately to preserve it
  renderUserList();

  // If a user is selected, load their messages
  if (selectedUser) {
    loadMessages(selectedUser.id);
    document.getElementById("messageInput").focus();
  }
}

// Update connection status display
function updateConnectionStatus() {
  const statusElement = document.getElementById("connectionStatus");
  if (statusElement) {
    statusElement.className = `connection-status ${
      isConnected ? "connected" : "disconnected"
    }`;
    statusElement.textContent = isConnected ? "Connected" : "Disconnected";
  }
}

// Load users list
async function loadUsers() {
  try {
    const response = await fetch(`users.php?currentUserId=${currentUser.id}`);
    const data = await response.json();

    if (data.error) {
      console.error(data.error);
      return;
    }

    users = data;
    renderUserList();
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

// Render user list
function renderUserList() {
  const userListElement = document.getElementById("userList");
  if (!userListElement) return;

  userListElement.innerHTML = users
    .map(
      (user) => `
        <li class="user-item ${selectedUser?.id === user.id ? "active" : ""}" 
            data-userid="${user.id}" 
            data-username="${user.username}">
            ${user.username}
        </li>
    `
    )
    .join("");

  // Add event listeners to user items
  document.querySelectorAll(".user-item").forEach((item) => {
    item.addEventListener("click", () => {
      const userId = parseInt(item.getAttribute("data-userid"));
      const username = item.getAttribute("data-username");
      selectedUser = { id: userId, username };

      // Update the chat header and messages without re-rendering everything
      document.getElementById(
        "chatHeader"
      ).innerHTML = `<h3>Chat with ${username}</h3>`;
      document.getElementById("messageForm").style.display = "flex";
      document.getElementById("messageInput").disabled = false;
      document.getElementById("messageInput").focus();
      document.querySelector(".send-button").disabled = false;

      // Update active state in user list
      document.querySelectorAll(".user-item").forEach((ui) => {
        ui.classList.toggle(
          "active",
          ui.getAttribute("data-userid") === userId.toString()
        );
      });

      loadMessages(userId);
    });
  });
}

// Load messages for a user
async function loadMessages(userId) {
  try {
    const response = await fetch(
      `messages.php?senderId=${currentUser.id}&receiverId=${userId}`
    );
    const data = await response.json();

    if (data.error) {
      console.error(data.error);
      return;
    }

    messages = data;
    renderMessages();
  } catch (err) {
    console.error("Failed to load messages:", err);
  }
}

// Render messages
function renderMessages() {
  const messagesContainer = document.getElementById("messagesContainer");
  if (!messagesContainer) return;

  messagesContainer.innerHTML = messages
    .map((message) => {
      const isSent = message.sender_id === currentUser.id;
      return `
            <div class="message ${isSent ? "sent" : "received"}">
                <div class="message-bubble">${message.content}</div>
                <div class="message-time">
                    ${new Date(message.timestamp).toLocaleTimeString()}
                </div>
            </div>
        `;
    })
    .join("");

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle sending a message
async function handleSendMessage(e) {
  e.preventDefault();
  const messageInput = document.getElementById("messageInput");
  const message = messageInput.value.trim();

  if (!message || !selectedUser) return;

  try {
    // Add message optimistically
    const tempMessage = {
      id: Date.now(), // Temporary ID
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: message,
      timestamp: new Date().toISOString(),
      sender_name: currentUser.username,
    };

    messages.push(tempMessage);
    renderMessages();
    messageInput.value = "";

    // Send to server
    const response = await fetch("messages.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        senderId: currentUser.id,
        receiverId: selectedUser.id,
        content: message,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(data.error);
      // You might want to show an error to the user here
      return;
    }

    // Replace temporary message with server response
    const index = messages.findIndex((m) => m.id === tempMessage.id);
    if (index !== -1) {
      messages[index] = data;
      renderMessages();
    }
  } catch (err) {
    console.error("Failed to send message:", err);
  }

  // Keep focus on input
  messageInput.focus();
}

// Handle logout
function handleLogout() {
  localStorage.removeItem("user");
  currentUser = null;
  selectedUser = null;
  if (socket) {
    socket.close();
    socket = null;
  }
  showLoginForm();
}
