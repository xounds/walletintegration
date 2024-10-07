'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTransactionToast } from '../ui/ui-layout';

// USDC token mint address
export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
export const USDC_DECIMALS = 6;

export function useGetBalance({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getBalance(address),
  });
}

export function useGetUsdcBalance({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ['get-usdc-balance', { endpoint: connection.rpcEndpoint, address }],
    queryFn: async () => {
      const tokenAccount = await getAssociatedTokenAddress(USDC_MINT, address);
      try {
        const balance = await connection.getTokenAccountBalance(tokenAccount);
        return Number(balance.value.amount);
      } catch (error) {
        console.error("Error fetching USDC balance:", error);
        return 0; // Return 0 if there's an error (e.g., if the token account doesn't exist)
      }
    },
  });
}

export function useTransferUsdc({ address }: { address: PublicKey }) {
  const { connection } = useConnection();
  const transactionToast = useTransactionToast();
  const wallet = useWallet();
  const client = useQueryClient();

  return useMutation({
    mutationKey: [
      'transfer-usdc',
      { endpoint: connection.rpcEndpoint, address },
    ],
    mutationFn: async (input: { destination: PublicKey; amount: number }) => {
      let signature: TransactionSignature = '';
      try {
        const { transaction, latestBlockhash } = await createUsdcTransaction({
          publicKey: address,
          destination: input.destination,
          amount: input.amount,
          connection,
        });

        // Send transaction and await for signature
        signature = await wallet.sendTransaction(transaction, connection);

        // Confirm transaction
        await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          'confirmed'
        );

        console.log(signature);
        return signature;
      } catch (error: unknown) {
        console.log('error', `Transaction failed! ${error}`, signature);
        throw error;
      }
    },
    onSuccess: (signature) => {
      if (signature) {
        transactionToast(signature);
      }
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-usdc-balance',
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'get-signatures',
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`Transaction failed! ${error}`);
    },
  });
}

export function useRequestAirdrop({ address }: { address: PublicKey }) {
  const { connection } = useConnection();
  const transactionToast = useTransactionToast();
  const client = useQueryClient();

  return useMutation({
    mutationKey: ['airdrop', { endpoint: connection.rpcEndpoint, address }],
    mutationFn: async (amount: number = 1) => {
      const [latestBlockhash, signature] = await Promise.all([
        connection.getLatestBlockhash(),
        connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL),
      ]);

      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        'confirmed'
      );
      return signature;
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'get-signatures',
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
      ]);
    },
  });
}

async function createUsdcTransaction({
  publicKey,
  destination,
  amount,
  connection,
}: {
  publicKey: PublicKey;
  destination: PublicKey;
  amount: number;
  connection: Connection;
}): Promise<{
  transaction: VersionedTransaction;
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number };
}> {
  const latestBlockhash = await connection.getLatestBlockhash();

  const fromTokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);
  const toTokenAccount = await getAssociatedTokenAddress(USDC_MINT, destination);

  const instructions = [];

  // Check if the destination token account exists
  const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
  if (!toTokenAccountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        publicKey,
        toTokenAccount,
        destination,
        USDC_MINT
      )
    );
  }

  instructions.push(
    createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      publicKey,
      amount * 10**USDC_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const messageLegacy = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToLegacyMessage();

  const transaction = new VersionedTransaction(messageLegacy);

  return {
    transaction,
    latestBlockhash,
  };
}