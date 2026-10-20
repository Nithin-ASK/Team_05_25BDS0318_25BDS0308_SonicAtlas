import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { keymap, EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { useMemo } from 'react';
import { useTheme } from '../lib/theme';

export default function SqlEditor({ value, onChange, onRun, schema, label }: {
  value: string; onChange: (v: string) => void; onRun: () => void; schema: Record<string, string[]>; label: string;
}) {
  const { theme } = useTheme();
  const extensions = useMemo(() => [
    sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true, defaultTable: 'tracks' }),
    Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { onRun(); return true; } }])),
    EditorView.contentAttributes.of({ 'aria-label': label }),
    EditorView.lineWrapping,
  ], [schema, onRun, label]);
  return (
    <div className="overflow-hidden rounded-lg border border-border" data-testid="sql-editor">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={theme === 'dark' ? oneDark : 'light'}
        minHeight="160px"
        maxHeight="360px"
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, autocompletion: true }}
      />
    </div>
  );
}
