<?php
require_once 'config.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true);

switch ($action) {
    case 'register':
        handleRegister($db, $data);
        break;
    case 'login':
        handleLogin($db, $data);
        break;
    default:
        echo json_encode(['error' => 'Invalid action']);
}

function handleRegister($db, $data) {
    if (empty($data['username']) || empty($data['password'])) {
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }

    try {
        $stmt = $db->prepare("INSERT INTO users (username, password) VALUES (:username, :password)");
        $stmt->execute([
            ':username' => $data['username'],
            ':password' => $data['password']
        ]);
        
        // MySQL alternative for RETURNING clause
        $userId = $db->lastInsertId();
        $stmt = $db->prepare("SELECT id, username FROM users WHERE id = :id");
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode($user);
    } catch (PDOException $e) {
        if ($e->errorInfo[1] == 1062) { // MySQL duplicate key error
            echo json_encode(['error' => 'Username already exists']);
        } else {
            echo json_encode(['error' => 'Registration failed: ' . $e->getMessage()]);
        }
    }
}

function handleLogin($db, $data) {
    if (empty($data['username']) || empty($data['password'])) {
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }

    try {
        $stmt = $db->prepare("SELECT id, username FROM users WHERE username = :username AND password = :password");
        $stmt->execute([
            ':username' => $data['username'],
            ':password' => $data['password']
        ]);
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            echo json_encode($user);
        } else {
            echo json_encode(['error' => 'Invalid credentials']);
        }
    } catch (PDOException $e) {
        echo json_encode(['error' => 'Login failed: ' . $e->getMessage()]);
    }
}
?>