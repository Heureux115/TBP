import {
  IsNumberString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWithdrawalDto {
  @IsNumberString()
  amount!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankName!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(40)
  bankAccountNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankAccountName!: string;
}
