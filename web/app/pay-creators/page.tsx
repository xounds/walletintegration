'use client';

import React, { useState, useEffect } from 'react';
import { BatchPaymentClient } from '../../components/pay-creators/pay-creators';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { firebaseConfig  } from './firebase-config';

// Firebase configuration
firebaseConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface PaymentInfo {
  wallet: string;
  amount: number;
}

export default function PayCreatorsPage() {
  const [paymentsToMake, setPaymentsToMake] = useState<PaymentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentsFromFirestore = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'creatorx'));
        const payments = querySnapshot.docs
          .map(doc => {
          const data = doc.data();
            return {
              wallet: data.wallet,
              amount: Number(data.amount)
            };
          })
          .filter(payment => 
            payment.wallet && 
            typeof payment.wallet === 'string' && 
            !isNaN(payment.amount) && 
            payment.amount > 0
          );

        setPaymentsToMake(payments);
      } catch (error) {
        console.error("Error fetching payments: ", error);
        setError("Failed to fetch payments. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentsFromFirestore();
  }, []);

  if (isLoading) {
    return <p>Loading payments...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div>
      <h1>Pay Creators</h1>
      {paymentsToMake.length > 0 ? (
        <BatchPaymentClient payments={paymentsToMake} />
      ) : (
        <p>No valid payments found.</p>
      )}
    </div>
  );
}