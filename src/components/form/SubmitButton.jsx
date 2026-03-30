import { Button } from '@mui/material';
import PropTypes from 'prop-types';
import React from 'react';

import { handleConversion } from '../../lib/converter';
import { downloadFiles, getAllFileContents, getIgnoredKeysFromLines } from '../../lib/files';

const SubmitButton = ({
  prefix,
  variableRegex,
  contentFormat,
  outputType,
  langSyntax,
  argsSyntax,
  argSyntax,
  ignoredKeys,
  ignoredLinesRef,
  itemKeyFormat,
  ignoreArrays,
  levelDelimiter,
  files,
}) => {
  const onSubmit = async (event) => {
    event.preventDefault();
    const fileContents = await getAllFileContents(files);
    const ignoredLines = ignoredLinesRef?.current?.ignoredLines ?? {};
    const lineIgnoredKeys = getIgnoredKeysFromLines(fileContents, ignoredLines, levelDelimiter);
    const mergedIgnoredKeys = [ignoredKeys, lineIgnoredKeys].filter(Boolean).join('\n');
    const result = handleConversion({
      prefix,
      variableRegex,
      contentFormat,
      outputType,
      langSyntax,
      argsSyntax,
      argSyntax,
      ignoredKeys: mergedIgnoredKeys,
      itemKeyFormat,
      ignoreArrays,
      levelDelimiter,
      files: fileContents,
    });
    downloadFiles(result);
  };

  return (
    <Button
      onClick={onSubmit}
      disabled={files.length === 0}
      variant='contained'
      color='primary'
      type='submit'
    >
      Convert
    </Button>
  );
};

SubmitButton.propTypes = {
  prefix: PropTypes.string,
  variableRegex: PropTypes.string,
  contentFormat: PropTypes.string,
  outputType: PropTypes.string,
  langSyntax: PropTypes.string,
  argsSyntax: PropTypes.string,
  argSyntax: PropTypes.string,
  ignoredKeys: PropTypes.string,
  ignoredLinesRef: PropTypes.object,
  itemKeyFormat: PropTypes.string,
  ignoreArrays: PropTypes.bool,
  files: PropTypes.arrayOf(PropTypes.any),
};

SubmitButton.defaultProps = {
  prefix: '',
  variableRegex: '',
  contentFormat: 'legacy',
  outputType: '',
  langSyntax: 'lang',
  argsSyntax: 'args',
  argSyntax: 'arg',
  ignoredKeys: '',
  ignoredLinesRef: null,
  itemKeyFormat: 'preserve',
  ignoreArrays: false,
  files: [],
};

export default SubmitButton;
