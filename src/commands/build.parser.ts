import commander from 'commander';
import { CliFlags, validateTimeoutFlag } from '../config';
import { checkOutputFormat, detectOutputFormat, OutputFormat } from '../output';

export interface BuildCliFlags extends CliFlags {
  output?: {
    output?: string;
    format?: string;
  }[];
  bypassedPdfBuilderOption?: string;
}

export function setupBuildParserProgram(): commander.Command {
  // Provide an order-sensitive command parser
  // ex: "-o foo -o bar -f baz"
  //    → [{output: "foo"}, {output:"bar", format: "baz"}]
  // ex: "-f foo -o bar -o baz -f piyo"
  //    → [{output: "bar", format: "foo"}, {output: "baz", format: "piyo"}]
  const targets: {
    output?: string;
    format?: string;
  }[] = [];
  const outputOptionProcessor = (
    value: string,
    previous?: string[],
  ): string[] => {
    if (targets.length === 0 || 'output' in targets[targets.length - 1]) {
      targets.push({ output: value });
    } else {
      targets[targets.length - 1].output = value;
    }
    return [...(previous || []), value];
  };
  const formatOptionProcessor = (
    value: string,
    previous?: string[],
  ): string[] => {
    if (targets.length === 0 || 'format' in targets[targets.length - 1]) {
      targets.push({ format: value });
    } else {
      targets[targets.length - 1].format = value;
    }
    return [...(previous || []), value];
  };

  const program = new commander.Command();
  program
    .name('vivliostyle build')
    .description('build and create PDF file')
    .arguments('[input]')
    .option(
      '-c, --config <config_file>',
      'path to vivliostyle.config.js [vivliostyle.config.js]',
    )
    .option(
      '-o, --output <path>',
      `specify output file name or directory [<title>.pdf]
This option can be specified multiple, then each -o options can be supplied one -f option.
ex: -o output1 -f webpub -o output2.pdf -f pdf`,
      outputOptionProcessor,
    )
    .option(
      '-f, --format <format>',
      `specify output format corresponding output target
If an extension is specified on -o option, this field will be inferenced automatically.`,
      formatOptionProcessor,
    )
    .option(
      '-s, --size <size>',
      `output pdf size [Letter]
preset: A5, A4, A3, B5, B4, JIS-B5, JIS-B4, letter, legal, ledger
custom(comma separated): 182mm,257mm or 8.5in,11in`,
    )
    .option('--style <stylesheet>', 'additional stylesheet URL or path')
    .option('--user-style <user_stylesheet>', 'user stylesheet URL or path')
    .option('-d, --single-doc', 'single HTML document input')
    .option(
      '-p, --press-ready',
      `make generated PDF compatible with press ready PDF/X-1a [false]
This option is equivalent with "--preflight press-ready"`,
    )
    .option(
      '-t, --timeout <seconds>',
      `timeout limit for waiting Vivliostyle process [60s]`,
      validateTimeoutFlag,
    )
    .option('-T, --theme <theme>', 'theme path or package name')
    .option('--title <title>', 'title')
    .option('--author <author>', 'author')
    .option('-l, --language <language>', 'language')
    .addOption(
      new commander.Option(
        '--render-mode <mode>',
        'if docker is set, Vivliostyle try to render PDF on Docker container [local]',
      ).choices(['local', 'docker']),
    )
    .addOption(
      new commander.Option(
        '--preflight <mode>',
        'apply the process to generate PDF for printing',
      ).choices(['press-ready', 'press-ready-local']),
    )
    .option(
      '--preflight-option <options...>',
      `options for preflight process (ex: gray-scale, enforce-outline)
Please refer the document of press-ready for further information.
https://github.com/vibranthq/press-ready`,
    )
    .option('--verbose', 'verbose log output')
    .option(
      '--no-sandbox',
      `launch chrome without sandbox. use this option when ECONNREFUSED error occurred.`,
    )
    .option(
      '--executable-chromium <path>',
      'specify a path of executable Chrome (or Chromium) you installed',
    )
    .option('--image <image>', 'specify a docker image to render')
    .addOption(
      new commander.Option('--bypassed-pdf-builder-option <json>').hideHelp(),
    )
    .action((_arg: any, option: BuildCliFlags) => {
      option.targets = inferenceTargetsOption(targets);
    });

  return program;
}

export function inferenceTargetsOption(
  parsed: {
    output?: string;
    format?: string;
  }[],
): Pick<OutputFormat, 'path' | 'format'>[] {
  return parsed.map(({ output, format }) => {
    if (!output) {
      // -f is an optional option but -o is required one
      throw new Error(
        `Couldn't find the output option corresponding --format ${format} option. Please check the command options.`,
      );
    }
    const detectedFormat = format ?? detectOutputFormat(output);
    if (!checkOutputFormat(detectedFormat)) {
      throw new Error(`Unknown format: ${format}`);
    }
    return { path: output, format: detectedFormat };
  });
}
