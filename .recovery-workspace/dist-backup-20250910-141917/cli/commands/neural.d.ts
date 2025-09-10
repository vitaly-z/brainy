/**
 * 🧠 Neural Similarity API Commands
 *
 * CLI interface for semantic similarity, clustering, and neural operations
 */
interface CommandArguments {
    action?: string;
    id?: string;
    query?: string;
    threshold?: number;
    format?: string;
    output?: string;
    limit?: number;
    algorithm?: string;
    dimensions?: number;
    explain?: boolean;
    _: string[];
}
export declare const neuralCommand: {
    command: string;
    describe: string;
    builder: (yargs: any) => any;
    handler: (argv: CommandArguments) => Promise<void>;
};
export default neuralCommand;
