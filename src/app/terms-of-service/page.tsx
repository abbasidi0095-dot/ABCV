import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | ABCV',
  description: 'Terms of Service for ABCV - the AI-powered CV generator.',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-card rounded-xl shadow-sm border border-border/60 p-8 sm:p-12">
        <div className="mb-8 border-b border-border/60 pb-8">
          <Link href="/" className="text-primary hover:text-primary/80 font-medium flex items-center mb-6">
            &larr; Back to Home
          </Link>
          <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="max-w-none text-foreground space-y-6">
          <p className="leading-relaxed">
            Welcome to ABCV. These Terms of Service outline the rules and regulations for the use of ABCV's Website and Services.
          </p>
          <p className="leading-relaxed">
            By accessing this website we assume you accept these terms of service. Do not continue to use ABCV if you do not agree to take all of the terms and conditions stated on this page.
          </p>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">1. License</h2>
          <p className="leading-relaxed">
            Unless otherwise stated, ABCV and/or its licensors own the intellectual property rights for all material on ABCV. All intellectual property rights are reserved. You may access this from ABCV for your own personal use subjected to restrictions set in these terms and conditions.
          </p>
          <p className="leading-relaxed">You must not:</p>
          <ul className="list-disc pl-5 mb-6 space-y-2 leading-relaxed">
            <li>Republish material from ABCV</li>
            <li>Sell, rent or sub-license material from ABCV</li>
            <li>Reproduce, duplicate or copy material from ABCV</li>
            <li>Redistribute content from ABCV</li>
          </ul>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">2. User Account</h2>
          <p className="leading-relaxed">
            If you create an account on our website, you are responsible for maintaining the security of your account, and you are fully responsible for all activities that occur under the account and any other actions taken in connection with it.
          </p>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">3. AI Generated Content</h2>
          <p className="leading-relaxed">
            Our service utilizes Artificial Intelligence (AI) to generate CVs and cover letters based on your inputs. While we strive for high quality, we do not guarantee the accuracy, completeness, or suitability of the generated content for any particular purpose. It is your responsibility to review and edit the generated content before use.
          </p>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">4. Limitation of Liability</h2>
          <p className="leading-relaxed">
            In no event shall ABCV, nor any of its officers, directors and employees, shall be held liable for anything arising out of or in any way connected with your use of this Website whether such liability is under contract. ABCV, including its officers, directors and employees shall not be held liable for any indirect, consequential or special liability arising out of or in any way related to your use of this Website.
          </p>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">5. Governing Law & Jurisdiction</h2>
          <p className="leading-relaxed">
            These Terms will be governed by and interpreted in accordance with the laws of the State/Country in which ABCV is based, and you submit to the non-exclusive jurisdiction of the state and federal courts located there for the resolution of any disputes.
          </p>
        </div>
      </div>
    </div>
  );
}
