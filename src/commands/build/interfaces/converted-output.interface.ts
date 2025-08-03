export interface ConvertedOutput {
  personalContext?: PersonalContextSpec;
  projectContext?: ProjectContextSpec;
  promptTemplates?: PromptTemplatesSpec;
}

export interface PersonalContextSpec {
  category: 'personal';
  spec_version: string;
  data: {
    developer_profile: DeveloperProfile;
    coding_preferences: CodingPreferences;
    domain_knowledge: string[];
    communication_style: CommunicationStyle;
  };
}

export interface ProjectContextSpec {
  category: 'project';
  spec_version: string;
  data: {
    project_info: ProjectInfo;
    tech_stack: TechStack;
    architecture_patterns: string[];
    development_practices: DevelopmentPractices;
  };
}

export interface PromptTemplatesSpec {
  category: 'prompts';
  spec_version: string;
  data: {
    templates: Record<string, PromptTemplate>;
    categories: string[];
    use_cases: string[];
  };
}

export interface DeveloperProfile {
  name?: string;
  experience_level: 'junior' | 'mid' | 'senior' | 'lead';
  primary_languages: string[];
  specializations: string[];
  preferred_tools: string[];
}

export interface CodingPreferences {
  code_style: {
    indentation: 'tabs' | 'spaces';
    indent_size: number;
    line_length: number;
    naming_convention: string;
  };
  testing_approach: string;
  documentation_style: string;
  error_handling_strategy: string;
}

export interface CommunicationStyle {
  verbosity: 'concise' | 'detailed' | 'comprehensive';
  explanation_depth: 'basic' | 'intermediate' | 'advanced';
  code_comments: 'minimal' | 'moderate' | 'extensive';
  preferred_examples: boolean;
}

export interface ProjectInfo {
  name: string;
  description?: string;
  type: 'web' | 'mobile' | 'desktop' | 'cli' | 'library' | 'api' | 'other';
  scale: 'small' | 'medium' | 'large' | 'enterprise';
  team_size: number;
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  deployment_platforms: string[];
}

export interface DevelopmentPractices {
  version_control: string;
  testing_strategy: string[];
  ci_cd: boolean;
  code_review_process: string;
  documentation_standards: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
  category: string;
  use_case: string;
  examples?: PromptExample[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default_value?: any;
}

export interface PromptExample {
  title: string;
  input: Record<string, any>;
  expected_output?: string;
}