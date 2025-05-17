# NIARB - Workflow Playground

A modern web application for creating, evaluating, and publishing workflows based on structured input data.

## Features

- Input data handling (JSON/CSV)
- Visual workflow builder
- Logic evaluation
- Calculation support
- AI model integration
- Multiple output formats (JSON/CSV/Excel)

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/niarb.git
cd niarb
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Create a `.env.local` file from `.env.local.example`
   - Add your Supabase credentials:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
src/
  ├── app/              # Next.js app router
  ├── components/       # React components
  │   ├── ui/          # shadcn/ui components
  │   └── ...          # Feature components
  ├── lib/             # Utility functions and configurations
  └── types/           # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
