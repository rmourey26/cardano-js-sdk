/* eslint-disable no-use-before-define */
import { Cardano } from '@cardano-sdk/core';
import { Directive, Field, Int, ObjectType } from 'type-graphql';
import { Epoch } from './Epoch';
import { ProtocolVersion } from './ProtocolParameters';
import { Slot } from './Slot';
import { StakePool } from './StakePool';
import { Transaction } from './Transaction';

@ObjectType()
export class Block {
  @Directive('@id')
  @Field(() => String)
  hash: Cardano.BlockId;
  @Field(() => Int)
  blockNo: Cardano.BlockNo;
  @Directive('@hasInverse(field: block)')
  @Field(() => Slot)
  slot: Slot;
  @Field(() => StakePool)
  issuer: StakePool;
  @Field(() => Epoch)
  epoch: Epoch;
  @Field(() => Int)
  size: Cardano.BlockSize;
  @Directive('@hasInverse(field: block)')
  @Field(() => [Transaction])
  transactions: Transaction[];
  @Field(() => String)
  totalOutput: Cardano.Lovelace;
  @Field(() => String)
  fees: Cardano.Lovelace;
  @Field(() => Block)
  previousBlock?: Block;
  @Field(() => Block)
  nextBlock?: Block;
  @Field(() => Int)
  confirmations: number;
  @Field(() => ProtocolVersion)
  nextBlockProtocolVersion: ProtocolVersion;
  @Field(() => String)
  opCert: Cardano.Hash32ByteBase16;
}
