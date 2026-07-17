import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from "typeorm";
import { Category } from "./Category";

export enum KnowledgeType { SOP = "SOP", BEST_PRACTICE = "BEST_PRACTICE", KPI = "KPI" }
export type KnowledgeContent =
  | { title: string; description: string; steps: { step_title: string; step_description: string }[]; tags: string[] }
  | { title: string; description: string; priority: "low" | "medium" | "high" }
  | { title: string; description: string; target_label: string | number; metadata: Record<string, string>[] };

@Entity("knowledge")
export class Knowledge {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "enum", enum: KnowledgeType }) type!: KnowledgeType;
  @Column({ type: "uuid" }) categoryId!: string;
  @ManyToOne(() => Category, (category) => category.knowledge, { onDelete: "CASCADE" })
  @JoinColumn({ name: "categoryId" }) category!: Relation<Category>;
  @Column({ type: "jsonb" }) content!: KnowledgeContent;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
