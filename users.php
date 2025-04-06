<?php
require_once 'config.php';

$currentUserId = $_GET['currentUserId'] ?? 0;

try {
    $stmt = $db->prepare("SELECT id, username FROM users WHERE id != :currentUserId");
    $stmt->execute([':currentUserId' => $currentUserId]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($users);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Failed to fetch users: ' . $e->getMessage()]);
}
?>