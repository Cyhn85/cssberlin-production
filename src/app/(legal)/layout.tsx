'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function LegalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-[#0D1117] min-h-screen pt-24 pb-16">
            <div className="container max-w-4xl mx-auto px-4">
                {/* Back Link */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-8"
                >
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors text-muted-foreground"
                    >
                        <ArrowLeft size={16} />
                        Zurück zur Startseite
                    </Link>
                </motion.div>

                {/* Content with Animation */}
                <motion.article
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="prose prose-slate dark:prose-invert max-w-none"
                >
                    {children}
                </motion.article>
            </div>
        </div>
    );
}
