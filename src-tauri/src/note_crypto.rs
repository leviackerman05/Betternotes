use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const PBKDF2_ITERS: u32 = 210_000;

pub fn base64_salt(salt: &[u8]) -> String {
    B64.encode(salt)
}

pub fn decode_salt(salt_b64: &str) -> Result<Vec<u8>, String> {
    B64.decode(salt_b64).map_err(|e| e.to_string())
}

pub fn generate_salt() -> Vec<u8> {
    let mut salt = vec![0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

fn derive_key(password: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERS, &mut key);
    key
}

pub fn hash_password(password: &str, salt: &[u8]) -> String {
    B64.encode(derive_key(password, salt))
}

pub fn verify_password(password: &str, salt: &[u8], stored_hash: &str) -> bool {
    hash_password(password, salt) == stored_hash
}

pub fn encrypt_content(plaintext: &str, password: &str, salt: &[u8]) -> Result<String, String> {
    let key = derive_key(password, salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(format!(
        "ENC:{}:{}",
        B64.encode(nonce_bytes),
        B64.encode(ciphertext)
    ))
}

pub fn decrypt_content(encrypted: &str, password: &str, salt: &[u8]) -> Result<String, String> {
    let payload = encrypted
        .strip_prefix("ENC:")
        .ok_or("Invalid encrypted content")?;
    let (nonce_b64, cipher_b64) = payload
        .split_once(':')
        .ok_or("Invalid encrypted content format")?;
    let nonce_bytes = B64.decode(nonce_b64).map_err(|e| e.to_string())?;
    let ciphertext = B64.decode(cipher_b64).map_err(|e| e.to_string())?;
    let key = derive_key(password, salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Incorrect password".to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}
