import { Link } from 'react-router-dom';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center group ${className}`}>
      <img
        src="https://yellowdog.bg/wp-content/uploads/2023/02/Logo_Yellow_Dog.png"
        alt="Студио Жълто куче"
        className="h-10 w-auto object-contain transition-opacity group-hover:opacity-80"
      />
    </Link>
  );
}
