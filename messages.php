<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get messages between two users
    $senderId = $_GET['senderId'] ?? 0;
    $receiverId = $_GET['receiverId'] ?? 0;
    
    try {
        $stmt = $db->prepare("
            SELECT m.*, u.username as sender_name 
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (sender_id = :senderId AND receiver_id = :receiverId) 
               OR (sender_id = :receiverId AND receiver_id = :senderId)
            ORDER BY timestamp
        ");
        $stmt->execute([
            ':senderId' => $senderId,
            ':receiverId' => $receiverId
        ]);
        
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($messages);
    } catch (PDOException $e) {
        echo json_encode(['error' => 'Failed to fetch messages: ' . $e->getMessage()]);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Send a new message
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['senderId']) || empty($data['receiverId']) || empty($data['content'])) {
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }
    
    try {
        // Check if users exist
        $stmt = $db->prepare("SELECT id FROM users WHERE id = :id");
        $stmt->execute([':id' => $data['senderId']]);
        if (!$stmt->fetch()) {
            throw new Exception("Invalid sender");
        }
        
        $stmt->execute([':id' => $data['receiverId']]);
        if (!$stmt->fetch()) {
            throw new Exception("Invalid receiver");
        }
        
        // Check for duplicate messages
        $stmt = $db->prepare("
            SELECT * FROM messages 
            WHERE sender_id = :senderId AND receiver_id = :receiverId AND content = :content
            AND timestamp > NOW() - INTERVAL '5 seconds'
        ");
        $stmt->execute([
            ':senderId' => $data['senderId'],
            ':receiverId' => $data['receiverId'],
            ':content' => $data['content']
        ]);
        
        $duplicate = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($duplicate) {
            echo json_encode($duplicate);
            return;
        }
        
        // Insert new message
        $stmt = $db->prepare("
            INSERT INTO messages (sender_id, receiver_id, content) 
            VALUES (:senderId, :receiverId, :content) 
            RETURNING *, (SELECT username FROM users WHERE id = :senderId) as sender_name
        ");
        $stmt->execute([
            ':senderId' => $data['senderId'],
            ':receiverId' => $data['receiverId'],
            ':content' => $data['content']
        ]);
        
        $message = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode($message);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Failed to send message: ' . $e->getMessage()]);
    }
}
?>