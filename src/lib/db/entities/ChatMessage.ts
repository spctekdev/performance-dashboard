import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from "typeorm";
import { ChatSession } from "./ChatSession";

export enum ChatMessageRole {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
  TOOL = "TOOL",
}
export enum ChatMessageStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

@Entity("chat_messages")
@Index(["sessionId", "createdAt"])
export class ChatMessage {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) sessionId!: string;
  @ManyToOne(() => ChatSession, (session) => session.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sessionId" })
  session!: Relation<ChatSession>;
  @Column({ type: "enum", enum: ChatMessageRole }) role!: ChatMessageRole;
  @Column({ type: "enum", enum: ChatMessageStatus, default: ChatMessageStatus.COMPLETED }) status!: ChatMessageStatus;
  @Column({ type: "text", default: "" }) content!: string;
  @Column({ type: "jsonb", nullable: true }) toolCalls!: unknown[] | null;
  @Column({ type: "jsonb", nullable: true }) toolResults!: unknown[] | null;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}
