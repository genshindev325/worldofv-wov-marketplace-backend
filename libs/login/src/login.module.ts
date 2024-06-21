import { GrpcClientModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AppJwtModule } from './app-jwt.module';
import { DiscordStrategy } from './strategies/discord.strategy';
import { InstagramStrategy } from './strategies/instagram.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwitterStrategy } from './strategies/twitter.strategy';

@Module({
  imports: [
    ConfigModule.forRoot(),
    GrpcClientModule.register(GrpcClientKind.USER),
    PassportModule.register({ defaultStrategy: 'jwt', session: true }),
    AppJwtModule,
  ],
  providers: [JwtStrategy, TwitterStrategy, DiscordStrategy, InstagramStrategy],
  exports: [AppJwtModule],
})
export class LoginModule {}
