import {
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as EmptyBoxIcon,
  DisabledByDefault as XBoxIcon,
} from '@mui/icons-material';
import { Box, Chip, IconButton, Tab, Tabs, Typography } from '@mui/material';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

const isCommentLine = (line) => {
  const t = line.trimStart();
  return t.startsWith('#') || t.startsWith('!') || t.startsWith('//');
};

// Memoized — only re-renders when its own isIgnored/filterMode props change
const LineRow = React.memo(function LineRow({ lineNumber, line, isIgnored, filterMode, fileName, idx, onToggle }) {
  const isWhitelist = filterMode === 'whitelist';
  // In blacklist mode: toggled lines are excluded. In whitelist mode: toggled lines are included.
  const appearsExcluded = isWhitelist ? !isIgnored : isIgnored;

  let icon, iconColor, iconHoverColor, title;
  if (isWhitelist) {
    if (isIgnored) {
      icon = <CheckBoxIcon />;
      iconColor = 'success.light';
      iconHoverColor = 'success.main';
      title = 'Remove from whitelist';
    } else {
      icon = <XBoxIcon />;
      iconColor = 'rgba(255,255,255,0.18)';
      iconHoverColor = 'rgba(255,255,255,0.55)';
      title = 'Add to whitelist';
    }
  } else {
    if (isIgnored) {
      icon = <XBoxIcon />;
      iconColor = 'error.light';
      iconHoverColor = 'error.main';
      title = 'Include in generation';
    } else {
      icon = <EmptyBoxIcon />;
      iconColor = 'rgba(255,255,255,0.18)';
      iconHoverColor = 'rgba(255,255,255,0.55)';
      title = 'Exclude from generation';
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        opacity: appearsExcluded ? 0.28 : 1,
        transition: 'opacity 0.12s',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
      }}
    >
      <IconButton
        onClick={() => onToggle(fileName, idx)}
        size='small'
        title={title}
        sx={{
          p: '2px',
          mx: '4px',
          mt: '2px',
          flexShrink: 0,
          color: iconColor,
          '&:hover': {
            color: iconHoverColor,
            bgcolor: 'transparent',
          },
          '& .MuiSvgIcon-root': { fontSize: '1.25rem' },
        }}
      >
        {icon}
      </IconButton>
      <Typography
        component='span'
        sx={{
          minWidth: 38,
          textAlign: 'right',
          pr: 1.5,
          color: 'text.disabled',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          lineHeight: '1.65em',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {lineNumber}
      </Typography>
      <Box
        component='pre'
        onClick={() => onToggle(fileName, idx)}
        sx={{
          m: 0,
          flex: 1,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: '1.65em',
          cursor: 'pointer',
          color: appearsExcluded ? 'text.disabled' : 'text.primary',
          textDecoration: appearsExcluded ? 'line-through' : 'none',
        }}
      >
        {line || ' '}
      </Box>
    </Box>
  );
});

const FilePreviewPanel = forwardRef(function FilePreviewPanel({ files }, ref) {
  const [activeTab, setActiveTab] = useState(0);
  const [fileContents, setFileContents] = useState({});
  const [ignoredLines, setIgnoredLines] = useState({});
  const [hideComments, setHideComments] = useState(false);
  const [filterMode, setFilterMode] = useState('blacklist');

  useImperativeHandle(ref, () => ({ ignoredLines, filterMode }), [ignoredLines, filterMode]);

  useEffect(() => {
    const newContents = {};
    const promises = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            newContents[file.name] = e.target.result;
            resolve();
          };
          reader.readAsText(file, 'utf-8');
        })
    );
    Promise.all(promises).then(() => setFileContents(newContents));
  }, [files]);

  useEffect(() => {
    if (activeTab >= files.length && files.length > 0) setActiveTab(0);
  }, [files.length]);

  const handleToggle = useCallback((fileName, idx) => {
    setIgnoredLines((prev) => {
      const current = new Set(prev[fileName] ?? []);
      if (current.has(idx)) current.delete(idx);
      else current.add(idx);
      return { ...prev, [fileName]: current };
    });
  }, []);

  if (!files.length) return null;

  const activeFile = files[activeTab];
  const content = fileContents[activeFile?.name] ?? '';
  const lines = content.split('\n');
  const ignored = ignoredLines[activeFile?.name] ?? new Set();

  return (
    <Box sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      {/* Header bar: tabs + comment toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant='scrollable'
          scrollButtons='auto'
          sx={{ flex: 1, minHeight: 36 }}
        >
          {files.map((file, i) => (
            <Tab
              key={file.name}
              label={file.name}
              value={i}
              sx={{ textTransform: 'none', fontSize: '0.78rem', minWidth: 0, minHeight: 36, py: 0.5 }}
            />
          ))}
        </Tabs>
        <Chip
          label={filterMode === 'whitelist' ? 'Whitelist' : 'Blacklist'}
          size='small'
          clickable
          variant='filled'
          onClick={() => setFilterMode((m) => (m === 'blacklist' ? 'whitelist' : 'blacklist'))}
          sx={{
            mr: 0.5,
            ml: 1,
            fontSize: '0.7rem',
            height: 22,
            flexShrink: 0,
            bgcolor: filterMode === 'whitelist' ? 'success.dark' : 'error.dark',
            color: 'common.white',
          }}
        />
        <Chip
          label='# comments'
          size='small'
          clickable
          variant={hideComments ? 'filled' : 'outlined'}
          onClick={() => setHideComments((v) => !v)}
          sx={{
            mr: 1.5,
            ml: 0.5,
            fontSize: '0.7rem',
            height: 22,
            flexShrink: 0,
            ...(hideComments && { bgcolor: 'primary.dark', color: 'primary.contrastText' }),
          }}
        />
      </Box>

      {/* Content */}
      <Box
        sx={{
          height: 480,
          overflow: 'auto',
          bgcolor: '#0a1628',
          fontFamily: '"Roboto Mono", "Courier New", monospace',
          fontSize: '0.8rem',
        }}
      >
        {lines.map((line, idx) => {
          if (hideComments && isCommentLine(line)) return null;
          return (
            <LineRow
              key={idx}
              lineNumber={idx + 1}
              line={line}
              isIgnored={ignored.has(idx)}
              filterMode={filterMode}
              fileName={activeFile.name}
              idx={idx}
              onToggle={handleToggle}
            />
          );
        })}
      </Box>
    </Box>
  );
});

export default FilePreviewPanel;
