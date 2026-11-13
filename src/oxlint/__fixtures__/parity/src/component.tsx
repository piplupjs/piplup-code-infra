import * as React from 'react';

export function List({ items }: { items: string[] }) {
  const [open, setOpen] = React.useState(false);
  if (open) {
    React.useEffect(() => {});
  }
  return (
    <div>
      <img src="a.png" />
      <a href="https://example.com" target="_blank">
        Link
      </a>
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {items.map((item) => (
        <span>{item}</span>
      ))}
    </div>
  );
}
