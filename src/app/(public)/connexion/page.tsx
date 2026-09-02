import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-20">
      <h1 className="mb-8 text-center">Connexion à l&apos;organisation</h1>
      <LoginForm />
    </div>
  );
}
