'use client';

import React, { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { useGetUsdcBalance, USDC_MINT, USDC_DECIMALS } from '../account/account-data-access';

interface PaymentInfo {
  wallet: string;
  amount: number; // Amount in USDC
}

interface BatchPaymentClientProps {
  payments: PaymentInfo[];
}

function BalanceUsdc({ balance }: { balance: number }) {
  return (
    <span>{(balance / 10**USDC_DECIMALS).toFixed(2)}</span>
  );
}

function AccountBalance({ address }: { address: PublicKey }) {
  const query = useGetUsdcBalance({ address });

  return (
    <div>
      <h2
        className="text-3xl font-bold cursor-pointer text-black"
        onClick={() => query.refetch()}
      >
        {query.data !== undefined ? <BalanceUsdc balance={query.data} /> : '...'} USDC
      </h2>
    </div>
  );
}

export function BatchPaymentClient({ payments }: BatchPaymentClientProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [status, setStatus] = useState<string>('');
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const makeBatchPayment = useCallback(async () => {
    if (!publicKey) {
      setStatus('Please connect your wallet first.');
      return;
    }

    setIsLoading(true);
    setStatus('');
    setTransactionSignature(null); // Reset previous signature

    try {
      const transaction = new Transaction();

      // Get the token account of the fromWallet address
      const fromTokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);

      for (const { wallet, amount } of payments) {
        try {
          const toPubkey = new PublicKey(wallet);
          const toTokenAccount = await getAssociatedTokenAddress(USDC_MINT, toPubkey);

          // Check if the recipient's token account exists
          const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);

          if (!toTokenAccountInfo) {
            // If the recipient's token account does not exist, create it
            transaction.add(
              createAssociatedTokenAccountInstruction(
                publicKey,
                toTokenAccount,
                toPubkey,
                USDC_MINT
              )
            );
          }

          // Add the transfer instruction to the transaction
          transaction.add(
            createTransferInstruction(
              fromTokenAccount,
              toTokenAccount,
              publicKey,
              Math.round(amount * 10**USDC_DECIMALS),
              [],
              TOKEN_PROGRAM_ID
            )
          );
        } catch (error) {
          console.error(`Error processing payment to ${wallet}:`, error);
          setStatus((prev) => `${prev}\nFailed to process payment to ${wallet}`);
        }
      }

      if (transaction.instructions.length === 0) {
        throw new Error('No valid payments to process');
      }

      // Send the single transaction with all payment instructions
      const signature = await sendTransaction(transaction, connection);

      // Confirm the transaction
      await connection.confirmTransaction(signature, 'confirmed');

      setTransactionSignature(signature); // Save transaction signature
      setStatus(`Batch payment successful!`);
    } catch (error) {
      console.error('Error:', error);
      setStatus(`Batch payment failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connection, sendTransaction, payments]);

  const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="p-4 max-w-2xl mx-auto text-black">
      <h1 className="text-2xl font-bold mb-4 text-black">USDC Batch Payment</h1>

      {payments.length > 0 && (
        <div className="mb-4 text-black">
          <h2 className="text-lg font-semibold mb-2">Payments to Make ({payments.length})</h2>
          <ul className="list-disc pl-5 text-black">
            {payments.map(({ wallet, amount }, index) => (
              <li key={index} className="text-sm text-black">
                {wallet} - {amount.toFixed(2)} USDC
              </li>
            ))}
          </ul>
          <p className="mt-2 font-bold text-black">Total: {totalAmount.toFixed(2)} USDC</p>
        </div>
      )}

      <button 
        onClick={makeBatchPayment} 
        disabled={!publicKey || payments.length === 0 || isLoading}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
      >
        {isLoading ? 'Processing...' : `Make Batch Payment (${totalAmount.toFixed(2)} USDC total)`}
      </button>

      {status && (
        <div className="mt-4 p-4 bg-gray-100 rounded text-black w-full break-all">
          {/* Increased padding and width */}
          <p className="whitespace-pre-line">{status}</p>
          {transactionSignature && (
            <p>
              View on Solana Explorer:{" "}
              <a
                href={`https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                {transactionSignature}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
