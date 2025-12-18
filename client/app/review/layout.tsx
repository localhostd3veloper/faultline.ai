export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-full flex-1 overflow-auto">{children}</div>;
}
