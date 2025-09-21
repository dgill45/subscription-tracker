type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string };

export function Button({ className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500";
  return <button className={`${base} ${className}`} {...props} />;
}
