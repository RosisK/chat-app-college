<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $senderId = $_GET['senderId'] ?? 0;
    $receiverId = $_GET['receiverId'] ?? 0;
    
    try {
        $stmt = $db->prepare("
            SELECT m.*, u.username as sender_name 
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (m.sender_id = :senderId AND m.receiver_id = :receiverId) 
               OR (m.sender_id = :receiverId AND m.receiver_id = :senderId)
            ORDER BY m.timestamp
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
        
        // MySQL version of duplicate check (5 second interval)
        $stmt = $db->prepare("
            SELECT * FROM messages 
            WHERE sender_id = :senderId 
            AND receiver_id = :receiverId 
            AND content = :content
            AND timestamp > DATE_SUB(NOW(), INTERVAL 5 SECOND)
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
        
        // Insert new message (MySQL version)
        $stmt = $db->prepare("
            INSERT INTO messages (sender_id, receiver_id, content) 
            VALUES (:senderId, :receiverId, :content)
        ");
        $stmt->execute([
            ':senderId' => $data['senderId'],
            ':receiverId' => $data['receiverId'],
            ':content' => $data['content']
        ]);
        
        // Get the inserted message with sender_name
        $messageId = $db->lastInsertId();
        $stmt = $db->prepare("
            SELECT m.*, u.username as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = :messageId
        ");
        $stmt->execute([':messageId' => $messageId]);
        $message = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode($message);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Failed to send message: ' . $e->getMessage()]);
    }
}
?>