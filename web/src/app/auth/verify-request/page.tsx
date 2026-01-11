export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        <div>
          <svg
            className="mx-auto h-16 w-16 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
            Check your email
          </h1>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            A sign-in link has been sent to your email address. Click the link
            to sign in to your account.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            The link will expire in 24 hours. If you don&apos;t see the email,
            check your spam folder.
          </p>
        </div>

        <a
          href="/auth/signin"
          className="inline-block text-blue-600 dark:text-blue-400 hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
