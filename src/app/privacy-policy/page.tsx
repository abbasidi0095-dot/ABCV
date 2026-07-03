import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | ABCV',
  description: 'Privacy Policy for ABCV - the AI-powered CV generator.',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-card rounded-xl shadow-sm border border-border/60 p-8 sm:p-12">
        <div className="mb-8 border-b border-border/60 pb-8">
          <Link href="/" className="text-primary hover:text-primary/80 font-medium flex items-center mb-6">
            &larr; Back to Home
          </Link>
          <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="max-w-none text-foreground space-y-6">
          <p className="leading-relaxed">
            At ABCV, we take your privacy seriously. This Privacy Policy explains how we collect, use,
            disclose, and safeguard your information when you visit our website and use our AI CV generator service.
          </p>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">1. Information We Collect</h2>
          <p className="leading-relaxed">We collect information that you provide directly to us when using our services:</p>
          <ul className="list-disc pl-5 mb-6 space-y-2 leading-relaxed">
            <li><strong>Personal Information:</strong> Name, email address, phone number, and location details you include in your CV.</li>
            <li><strong>Professional Information:</strong> Work history, education, skills, and other professional details you input or upload.</li>
            <li><strong>Account Information:</strong> Login credentials when you create an account.</li>
          </ul>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">2. How We Use Your Information</h2>
          <p className="leading-relaxed">We use the information we collect primarily to provide, maintain, and improve our services:</p>
          <ul className="list-disc pl-5 mb-6 space-y-2 leading-relaxed">
            <li>To generate your CVs and cover letters using AI technologies.</li>
            <li>To create and manage your account.</li>
            <li>To process your transactions and payments.</li>
            <li>To communicate with you regarding updates, security alerts, and support messages.</li>
          </ul>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">3. Data Security and Storage</h2>
          <p className="leading-relaxed">
            We implement appropriate technical and organizational security measures designed to protect the security of any personal information we process.
            However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.
          </p>
          
          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">4. Sharing Your Information</h2>
          <p className="leading-relaxed">
            We do not sell your personal information. We may share information with third-party vendors, service providers, contractors, or agents who perform services for us or on our behalf and require access to such information to do that work (such as payment processing and AI model providers like Google Vertex AI).
          </p>

          <h2 className="text-xl font-bold text-foreground mt-8 mb-4">5. Contact Us</h2>
          <p className="leading-relaxed">
            If you have questions or comments about this Privacy Policy, please contact us at: support@abcv.com
          </p>
        </div>
      </div>
    </div>
  );
}
