import { Keypair } from '@solana/web3.js';
import * as fs from 'fs/promises';
import * as path from 'path';

function generatePublicKeys(count: number): string[] {
  return Array.from({ length: count }, () => 
    Keypair.generate().publicKey.toBase58()
  );
}

async function savePublicKeysToFile(publicKeys: string[], filename: string): Promise<void> {
  const fileContent = publicKeys.join('\n');
  const filePath = path.join(__dirname, filename);

  try {
    await fs.writeFile(filePath, fileContent);
    console.log(`Public keys have been saved to ${filePath}`);
  } catch (error) {
    console.error('Error writing to file:', error);
  }
}

async function main() {
  const publicKeys = generatePublicKeys(10);
  await savePublicKeysToFile(publicKeys, 'solana_public_keys.txt');

  console.log('Generated Solana Public Keys:');
  publicKeys.forEach((publicKey, index) => {
    console.log(`${index + 1}: ${publicKey}`);
  });
}

main().catch(error => console.error('An error occurred:', error));