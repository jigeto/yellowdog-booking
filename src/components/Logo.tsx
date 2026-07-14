import { Link } from 'react-router-dom';

export function Logo({ className = '', href }: { className?: string; href?: string }) {
  const content = (
    <img
      src="https://yellowdog.bg/wp-content/uploads/2023/02/Logo_Yellow_Dog.png"
      alt="Студио Жълто куче"
      className="h-10 w-auto object-contain transition-opacity group-hover:opacity-80"
    />
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center group ${className}`}>
        {content}
      </a>
    );
  }

  return (
    <Link to="/" className={`inline-flex items-center group ${className}`}>
      {content}
    </Link>
  );
}
