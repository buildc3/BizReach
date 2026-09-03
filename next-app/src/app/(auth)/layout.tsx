export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground px-4">
      {children}
    </div>
  );
}
